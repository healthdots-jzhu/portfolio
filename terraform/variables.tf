variable "aws_region" {
  type        = string
  description = "AWS region to deploy resources"
  default     = "ca-central-1"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "dev"
}

variable "project_name" {
  type        = string
  description = "Project name for resource naming"
  default     = "healthdots"
}

# VPC and Networking
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  type        = string
  description = "CIDR block for public subnet (EC2)"
  default     = "10.0.0.0/20"
}

variable "private_subnet_cidr" {
  type        = string
  description = "CIDR block for private subnet (RDS)"
  default     = "10.0.128.0/20"
}

# Additional pre-existing subnets managed by Terraform (defaults kept to previous hard-coded values)
variable "private_2a_cidr" {
  type        = string
  description = "CIDR block for additional private subnet 2a"
  default     = "10.0.144.0/20"
}

variable "private_2b_cidr" {
  type        = string
  description = "CIDR block for additional private subnet 2b"
  default     = "10.0.160.0/20"
}

variable "private_app_2a_cidr" {
  type        = string
  description = "CIDR block for application-private subnet 2a"
  default     = "10.0.176.0/20"
}

variable "private_app_2b_cidr" {
  type        = string
  description = "CIDR block for application-private subnet 2b"
  default     = "10.0.192.0/20"
}

# Route53 / DNS
variable "route53_zone_name" {
  type        = string
  description = "Parent Route53 zone name (e.g. healthdots.net)"
  default     = "healthdots.net"
}

variable "api_subdomain" {
  type        = string
  description = "Subdomain for the API (left-hand label, e.g. 'api' for api.healthdots.net)"
  default     = "api"
}

variable "path_base" {
  type        = string
  description = "Optional PathBase the app is hosted under (e.g. /portfolio-beta/content)"
  default     = ""
}

# EC2 Configuration
variable "rds_ssm_ec2_instance_type" {
  type        = string
  description = "EC2 instance type stored in SSM for RDS-related provisioning (e.g., t4g.micro)"
  default     = "t4g.micro"
}

# RDS Configuration
variable "rds_instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage" {
  type        = number
  description = "Allocated storage in GB for RDS"
  default     = 20
}

variable "postgres_version" {
  type        = string
  description = "PostgreSQL version"
  default     = "16.1"
}

variable "rds_database_name" {
  type        = string
  description = "Initial database name"
  default     = "portfoliodb"
}

variable "rds_username" {
  type        = string
  description = "RDS master username"
  default     = "postgres"
  sensitive   = true
}

variable "rds_skip_final_snapshot" {
  type        = bool
  description = "Skip final snapshot on RDS deletion"
  default     = true
}

variable "rds_backup_retention_period" {
  type        = number
  description = "Number of days to retain backups"
  default     = 7
}

variable "rds_multi_az" {
  type        = bool
  description = "Enable Multi-AZ for RDS"
  default     = false
}

variable "rds_storage_type" {
  type        = string
  description = "Storage type for RDS (gp2, gp3, io1, io2)"
  default     = "gp2"
}
