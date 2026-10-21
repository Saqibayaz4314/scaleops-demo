output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = "http://${aws_lb.main.dns_name}"
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "asg_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.main.name
}

output "launch_template_id" {
  description = "ID of the EC2 Launch Template"
  value       = aws_launch_template.main.id
}

output "launch_template_latest_version" {
  description = "Latest version number of the EC2 Launch Template"
  value       = aws_launch_template.main.latest_version
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "target_group_arn" {
  description = "ARN of the ALB Target Group"
  value       = aws_lb_target_group.main.arn
}

output "ec2_iam_role_arn" {
  description = "ARN of the IAM role attached to EC2 instances"
  value       = aws_iam_role.ec2.arn
}

output "artifact_version" {
  description = "Artifact version deployed to EC2 instances"
  value       = var.artifact_version
}

output "health_check_url" {
  description = "URL to verify application health via ALB"
  value       = "http://${aws_lb.main.dns_name}/api/health"
}
