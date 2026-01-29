variable "github_token" {
  description = "GitHub token with permissions to create repository variables/secrets"
  type        = string
}

variable "github_owner" {
  description = "GitHub owner/org name"
  type        = string
}

variable "repository" {
  description = "Repository name"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account id for the OIDC role"
  type        = string
}

variable "tf_state_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, qa, staging, beta, prod)"
  type        = string
  default     = "dev"
}

variable "tf_state_key" {
  description = "S3 key for Terraform state"
  type        = string
  default     = "portfolio/terraform.tfstate"
}

variable "tf_state_region" {
  description = "Region for Terraform S3 state"
  type        = string
  default     = "ca-central-1"
}

variable "tf_state_dynamodb_table" {
  description = "DynamoDB table name for Terraform locks"
  type        = string
}

variable "ecr_registry" {
  description = "ECR registry (repository) URL"
  type        = string
  default     = ""
}

variable "ecr_repository_arn" {
  description = "Optional ECR repository ARN to scope permissions"
  type        = string
  default     = ""
}

variable "role_name" {
  description = "Name for the created IAM role"
  type        = string
  default     = "github-actions-oidc-role"
}

variable "create_aws_role_secret" {
  description = "When true, instruct the github_provider module to create the CI_AWS_ROLE_ARN environment secret."
  type        = bool
  default     = false
}
