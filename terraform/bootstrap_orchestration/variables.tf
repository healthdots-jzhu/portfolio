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

variable "existing_oidc_provider_arn" {
  description = "ARN of an existing AWS OIDC provider to use when Terraform does not manage the provider. Provide this if the ci_aws_oidc module has its OIDC provider resource commented out or unmanaged."
  type        = string
  default     = ""
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



variable "tf_state_dynamodb_table" {
  description = "DynamoDB table name for Terraform locks"
  type        = string
}



variable "ecr_repository_arn" {
  description = "Optional ECR repository ARN to scope permissions"
  type        = string
  default     = ""
}

variable "role_name" {
  description = "Name for the created IAM role"
  type        = string
  default     = ""
}

variable "create_repo_aws_role_secret" {
  description = "When true, instruct the github_provider module to create the CI_AWS_ROLE_ARN repository secret."
  type        = bool
  default     = false
}

variable "environments" {
  description = "Optional map of environments to create. When provided, values will be forwarded to the github_provider module to create multiple environment-scoped variables/secrets in one apply."
  type = map(object({
    tf_state_key           = string
    aws_region             = string
    ecr_registry           = string
    s3_bucket_frontend     = string
  }))
  default = {}
}
