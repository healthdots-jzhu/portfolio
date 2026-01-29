// Repository-level Actions variables removed — using environment-scoped variables instead.

// Note: repository-level AWS role secret removed; prefer environment-scoped secret

# Create a GitHub Environment and an environment-scoped secret (if role ARN provided)
resource "github_repository_environment" "env" {
  repository  = var.repository
  environment = var.environment
}

resource "github_actions_environment_variable" "s3_bucket_frontend_env" {
  count       = var.s3_bucket_frontend != "" ? 1 : 0
  repository  = var.repository
  environment = var.environment
  variable_name = "S3_BUCKET_FRONTEND"
  value       = var.s3_bucket_frontend
  depends_on  = [github_repository_environment.env]
}

resource "github_actions_environment_variable" "tf_state_bucket_env" {
  count       = var.tf_state_bucket != "" ? 1 : 0
  repository  = var.repository
  environment = var.environment
  variable_name = "TF_STATE_BUCKET"
  value       = var.tf_state_bucket
  depends_on  = [github_repository_environment.env]
}

resource "github_actions_environment_variable" "tf_state_key_env" {
  count       = var.tf_state_key != "" ? 1 : 0
  repository  = var.repository
  environment = var.environment
  variable_name = "TF_STATE_KEY"
  value       = var.tf_state_key
  depends_on  = [github_repository_environment.env]
}

resource "github_actions_environment_variable" "tf_state_region_env" {
  count       = var.tf_state_region != "" ? 1 : 0
  repository  = var.repository
  environment = var.environment
  variable_name = "TF_STATE_REGION"
  value       = var.tf_state_region
  depends_on  = [github_repository_environment.env]
}

resource "github_actions_environment_variable" "tf_state_dynamodb_table_env" {
  count       = var.tf_state_dynamodb_table != "" ? 1 : 0
  repository  = var.repository
  environment = var.environment
  variable_name = "TF_STATE_DYNAMODB_TABLE"
  value       = var.tf_state_dynamodb_table
  depends_on  = [github_repository_environment.env]
}

resource "github_actions_environment_variable" "ecr_registry_env" {
  count       = var.ecr_registry != "" ? 1 : 0
  repository  = var.repository
  environment = var.environment
  variable_name = "ECR_REGISTRY"
  value       = var.ecr_registry
  depends_on  = [github_repository_environment.env]
}

resource "github_actions_environment_secret" "aws_role_arn_env" {
  count         = var.create_aws_role_secret ? 1 : 0
  repository    = var.repository
  environment   = var.environment
  secret_name   = "CI_AWS_ROLE_ARN"
  plaintext_value = var.aws_role_arn
  depends_on    = [github_repository_environment.env]
}
