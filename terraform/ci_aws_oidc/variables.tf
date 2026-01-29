variable "aws_region" {
  type    = string
  default = "ca-central-1"
}

variable "aws_account_id" {
  description = "AWS account ID where the role will be created"
  type        = string
}

variable "github_owner" {
  description = "GitHub owner/org for OIDC subject condition"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository name for OIDC subject condition"
  type        = string
}

variable "role_name" {
  type    = string
  default = "github-actions-oidc-role"
}

variable "tf_state_bucket" {
  type = string
}

variable "tf_state_dynamodb_table" {
  type = string
}

variable "ecr_repository_arn" {
  type = string
  default = ""
}
