# ──────────────────────────────────────────────
# Core
# ──────────────────────────────────────────────
variable "project_name" {
  description = "Short name used for resource naming and tagging"
  type        = string
  default     = "scaleops-demo"
}

variable "environment" {
  description = "Deployment environment (e.g. hackathon, staging, prod)"
  type        = string
  default     = "hackathon"
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

# ──────────────────────────────────────────────
# Networking
# ──────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

# ──────────────────────────────────────────────
# Compute
# ──────────────────────────────────────────────
variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "ami_id" {
  description = "Amazon Linux 2023 AMI ID. Leave empty to auto-select latest."
  type        = string
  default     = ""
}

# ──────────────────────────────────────────────
# Auto Scaling
# ──────────────────────────────────────────────
variable "asg_min_size" {
  description = "Minimum number of EC2 instances"
  type        = number
  default     = 1
}

variable "asg_desired_size" {
  description = "Desired number of EC2 instances"
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Maximum number of EC2 instances"
  type        = number
  default     = 3
}

variable "cpu_target_value" {
  description = "Target CPU utilization (%) for the scaling policy"
  type        = number
  default     = 50
}

variable "instance_warmup_seconds" {
  description = "Seconds to wait after instance launch before including in scaling metrics"
  type        = number
  default     = 120
}

variable "health_check_grace_period" {
  description = "Seconds ASG waits before running health checks on a new instance"
  type        = number
  default     = 180
}

# ──────────────────────────────────────────────
# Deployment
# ──────────────────────────────────────────────
variable "deploy_artifact_bucket" {
  description = "S3 bucket that stores versioned application release artifacts"
  type        = string
}

variable "artifact_version" {
  description = "Git SHA / artifact version to deploy (e.g. abc1234)"
  type        = string
}

variable "app_port" {
  description = "TCP port the Next.js application listens on"
  type        = number
  default     = 3000
}

variable "node_version" {
  description = "Node.js major version to install on EC2 instances"
  type        = string
  default     = "20"
}
