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
  default     = "10.0.1.0/24"
}

variable "private_subnet_cidr" {
  type        = string
  description = "CIDR block for private subnet (RDS)"
  default     = "10.0.2.0/24"
}

# EC2 Configuration
variable "instance_type" {
  type        = string
  description = "EC2 instance type (t4g.micro uses Graviton2 ARM processor)"
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
