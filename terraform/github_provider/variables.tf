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

variable "aws_region" {
  description = "AWS region for this environment (used to populate AWS_REGION environment variable)"
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

variable "create_repo_aws_role_secret" {
  description = "When true, create a repository-scoped secret named CI_AWS_ROLE_ARN with the value in var.aws_role_arn."
  type        = bool
  default     = false
}

variable "environments" {
  description = "Map of environments to create. Each key is the environment name and the value is an object (any) with the environment-scoped values. Extra keys are allowed and will be forwarded to the module resources."
  type    = map(any)
  default = {}
  validation {
    condition     = length(var.environments) > 0
    error_message = "The variable 'environments' must be a non-empty map. Provide at least one environment entry."
  }
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

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID (shared across environments) to create as a repository-level variable"
  type        = string
  default     = ""
}

variable "cognito_user_pool_client_id" {
  description = "Cognito User Pool App Client ID (shared across environments) to create as a repository-level variable"
  type        = string
  default     = ""
}

variable "cognito_user_pool_domain" {
  description = "Cognito Hosted UI domain (shared across environments) to create as a repository-level variable"
  type        = string
  default     = ""
}
