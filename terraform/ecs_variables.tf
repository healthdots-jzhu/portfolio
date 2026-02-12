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

variable "s3_bucket_name" {
  type        = string
  description = "S3 bucket name for portfolio assets"
  default     = "healthdots-portfolio-web-app-001"
}

# ALB authentication variables removed from common variables file.
# This is intentionally configured per-environment or supplied via secure tfvars.

variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito User Pool ID (e.g. ca-central-1_xxx) used to compute the user pool ARN for ALB authenticate-cognito"
}

variable "cognito_user_pool_client_id" {
  type        = string
  description = "Cognito User Pool App Client ID used by ALB authenticate-cognito"
}

variable "cognito_user_pool_domain" {
  type        = string
  description = "Cognito Hosted UI domain (e.g., your-domain.auth.region.amazoncognito.com) used by ALB authenticate-cognito"
}
