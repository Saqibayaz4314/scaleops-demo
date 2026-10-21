# ──────────────────────────────────────────────────────────────────────────────
# DATA SOURCES
# ──────────────────────────────────────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}

# Use latest Amazon Linux 2023 AMI if no AMI ID specified
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  ami_id       = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux_2023.id
  project_name = var.project_name
  common_name  = "${var.project_name}-${var.environment}"
}

# ──────────────────────────────────────────────────────────────────────────────
# VPC & NETWORKING
# ──────────────────────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.common_name}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.common_name}-igw"
  }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true # Required for outbound internet access without NAT Gateway

  tags = {
    Name = "${local.common_name}-public-subnet-${count.index + 1}"
    Tier = "public"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.common_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ──────────────────────────────────────────────────────────────────────────────
# SECURITY GROUPS
# ──────────────────────────────────────────────────────────────────────────────

# ALB Security Group — accepts HTTP from the internet
resource "aws_security_group" "alb" {
  name        = "${local.common_name}-alb-sg"
  description = "Allow HTTP inbound to Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.common_name}-alb-sg"
  }
}

# EC2 Security Group — only accepts traffic from the ALB SG on app port
resource "aws_security_group" "ec2" {
  name        = "${local.common_name}-ec2-sg"
  description = "Allow app port inbound only from ALB security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Next.js app from ALB only"
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound (S3, IMDSv2, package installs)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.common_name}-ec2-sg"
  }
}

# ──────────────────────────────────────────────────────────────────────────────
# IAM — EC2 Instance Role (least privilege)
# ──────────────────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "${local.common_name}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = {
    Name = "${local.common_name}-ec2-role"
  }
}

# Allow EC2 instances to read artifacts from S3
data "aws_iam_policy_document" "ec2_s3_read" {
  statement {
    sid    = "ReadArtifactBucket"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::${var.deploy_artifact_bucket}",
      "arn:aws:s3:::${var.deploy_artifact_bucket}/*",
    ]
  }
}

resource "aws_iam_policy" "ec2_s3_read" {
  name        = "${local.common_name}-ec2-s3-read"
  description = "Allow EC2 instances to read deployment artifacts from S3"
  policy      = data.aws_iam_policy_document.ec2_s3_read.json
}

resource "aws_iam_role_policy_attachment" "ec2_s3_read" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_s3_read.arn
}

# CloudWatch agent — write metrics and logs
resource "aws_iam_role_policy_attachment" "ec2_cloudwatch" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.common_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ──────────────────────────────────────────────────────────────────────────────
# EC2 LAUNCH TEMPLATE
# ──────────────────────────────────────────────────────────────────────────────

resource "aws_launch_template" "main" {
  name_prefix   = "${local.common_name}-lt-"
  image_id      = local.ami_id
  instance_type = var.instance_type

  # Enforce IMDSv2
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  # Encrypted root volume
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 20
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ec2.id]
    delete_on_termination       = true
  }

  iam_instance_profile {
    arn = aws_iam_instance_profile.ec2.arn
  }

  monitoring {
    enabled = true
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh.tftpl", {
    artifact_bucket  = var.deploy_artifact_bucket
    artifact_version = var.artifact_version
    aws_region       = var.aws_region
    app_port         = var.app_port
    node_version     = var.node_version
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name            = "${local.common_name}-instance"
      ArtifactVersion = var.artifact_version
    }
  }

  tag_specifications {
    resource_type = "volume"
    tags = {
      Name = "${local.common_name}-volume"
    }
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.common_name}-lt"
  }
}

# ──────────────────────────────────────────────────────────────────────────────
# APPLICATION LOAD BALANCER
# ──────────────────────────────────────────────────────────────────────────────

resource "aws_lb" "main" {
  name               = "${local.common_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "${local.common_name}-alb"
  }
}

resource "aws_lb_target_group" "main" {
  name        = "${local.common_name}-tg"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/api/health"
    protocol            = "HTTP"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 15
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "${local.common_name}-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

# ──────────────────────────────────────────────────────────────────────────────
# AUTO SCALING GROUP
# ──────────────────────────────────────────────────────────────────────────────

resource "aws_autoscaling_group" "main" {
  name                      = "${local.common_name}-asg"
  min_size                  = var.asg_min_size
  max_size                  = var.asg_max_size
  desired_capacity          = var.asg_desired_size
  vpc_zone_identifier       = aws_subnet.public[*].id
  target_group_arns         = [aws_lb_target_group.main.arn]
  health_check_type         = "ELB"
  health_check_grace_period = var.health_check_grace_period

  # Publish per-group metrics (incl. GroupInServiceInstances) so instance count
  # can be charted over time in CloudWatch / ScaleOps.
  enabled_metrics = [
    "GroupDesiredCapacity",
    "GroupInServiceInstances",
    "GroupMinSize",
    "GroupMaxSize",
    "GroupPendingInstances",
    "GroupTotalInstances",
  ]

  metrics_granularity = "1Minute"

  launch_template {
    id      = aws_launch_template.main.id
    version = aws_launch_template.main.latest_version
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup        = var.instance_warmup_seconds
    }
  }

  tag {
    key                 = "Name"
    value               = "${local.common_name}-instance"
    propagate_at_launch = true
  }

  tag {
    key                 = "ArtifactVersion"
    value               = var.artifact_version
    propagate_at_launch = true
  }

  lifecycle {
    ignore_changes = [desired_capacity]
  }
}

# ──────────────────────────────────────────────────────────────────────────────
# AUTO SCALING POLICIES — CPU Target Tracking
# ──────────────────────────────────────────────────────────────────────────────

resource "aws_autoscaling_policy" "cpu_tracking" {
  name                   = "${local.common_name}-cpu-tracking"
  autoscaling_group_name = aws_autoscaling_group.main.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value     = var.cpu_target_value
    disable_scale_in = false
  }

  estimated_instance_warmup = var.instance_warmup_seconds
}
