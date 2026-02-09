# ECS Configuration
variable "ecs_task_cpu" {
  type        = string
  description = "CPU units for ECS task (256 = 0.25 vCPU)"
  default     = "256"
}

variable "ecs_task_memory" {
  type        = string
  description = "Memory for ECS task in MB"
  default     = "512"
}

variable "ecs_service_desired_count" {
  type        = number
  description = "Desired number of ECS tasks"
  default     = 1
}

variable "acm_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS listener"
}

variable "s3_bucket_name" {
  type        = string
  description = "S3 bucket name for portfolio assets"
  default     = "healthdots-portfolio-web-app-001"
}
