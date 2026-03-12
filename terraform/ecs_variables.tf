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

variable "acm_certificate_arns" {
  type        = list(string)
  description = "List of ACM certificate ARNs for HTTPS listener (first = default)"
  default     = []
}

variable "api_certificate_arn_index" {
  type        = number
  description = "Index into acm_certificate_arns selecting which certificate should be default for API (0-based)"
  default     = 0
}

variable "s3_bucket_frontend" {
  type        = string
  description = "S3 bucket name for portfolio assets"
  default     = "healthdots-portfolio-web-app-001"
}
