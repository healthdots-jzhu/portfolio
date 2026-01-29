variable "github_token" {
  description = "GitHub token with repo access to manage Actions variables/secrets"
  type        = string
  default     = ""
}

variable "github_owner" {
  description = "GitHub organization or user owning the repository"
  type        = string
}

variable "repository" {
  description = "Repository name (without owner)"
  type        = string
}

variable "tf_state_bucket" {
  description = "S3 bucket name for Terraform state"
  type        = string
  default     = ""
}

variable "tf_state_key" {
  description = "S3 key for Terraform state"
  type        = string
  default     = ""
}

variable "tf_state_region" {
  description = "Region for Terraform S3 state"
  type        = string
  default     = "ca-central-1"
}

variable "tf_state_dynamodb_table" {
  description = "DynamoDB table for Terraform state locking"
  type        = string
  default     = ""
}

variable "ecr_registry" {
  description = "ECR registry URL (non-secret)"
  type        = string
  default     = ""
}

variable "s3_bucket_frontend" {
  description = "S3 bucket name for frontend assets (non-sensitive). This can be overridden by environment-scoped variables in GitHub Environments."
  type        = string
  default     = ""
}

variable "create_aws_role_secret" {
  description = "When true, create the CI_AWS_ROLE_ARN environment-scoped secret using the value in var.aws_role_arn. Set to true after the CI role exists."
  type        = bool
  default     = false
}

variable "aws_role_arn" {
  description = <<-EOT
Optional: AWS Role ARN to store as a repository secret (plaintext will be encrypted).
Use this if you prefer storing role ARN in GitHub secrets. If empty, no secret will be created.
EOT
  type        = string
  default     = ""
}

variable "environment" {
  description = "Environment name (e.g., dev, qa, staging, beta, prod)"
  type        = string
  default     = "dev"
}
