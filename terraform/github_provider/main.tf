// Repository-level Actions variables removed — using environment-scoped variables instead.

// Note: repository-level AWS role secret removed; prefer environment-scoped secret

// Create a GitHub Environment and an environment-scoped secret (if role ARN provided)
locals {
  // Require callers to provide `var.environments`; map of env name => values
  envs = var.environments
}

resource "github_repository_environment" "env" {
  for_each    = local.envs
  repository  = var.repository
  environment = each.key
}

resource "github_actions_environment_variable" "s3_bucket_frontend_env" {
  for_each      = { for k, v in local.envs : k => v if v.s3_bucket_frontend != "" }
  repository    = var.repository
  environment   = each.key
  variable_name = "S3_BUCKET_FRONTEND"
  value         = each.value.s3_bucket_frontend
  depends_on    = [github_repository_environment.env]
}


resource "github_actions_environment_variable" "tf_state_key_env" {
  for_each      = { for k, v in local.envs : k => v if v.tf_state_key != "" }
  repository    = var.repository
  environment   = each.key
  variable_name = "TF_STATE_KEY"
  value         = each.value.tf_state_key
  depends_on    = [github_repository_environment.env]
}

resource "github_actions_environment_variable" "aws_region_env" {
  for_each      = { for k, v in local.envs : k => v if v.aws_region != "" }
  repository    = var.repository
  environment   = each.key
  variable_name = "AWS_REGION"
  value         = each.value.aws_region
  depends_on    = [github_repository_environment.env]
}


resource "github_actions_environment_variable" "ecr_registry_env" {
  for_each      = { for k, v in local.envs : k => v if v.ecr_registry != "" }
  repository    = var.repository
  environment   = each.key
  variable_name = "ECR_REGISTRY"
  value         = each.value.ecr_registry
  depends_on    = [github_repository_environment.env]
}

# Repository-level Actions variables for shared values
resource "github_actions_variable" "tf_state_bucket_repo" {
  count         = var.tf_state_bucket != "" ? 1 : 0
  repository    = var.repository
  variable_name = "TF_STATE_BUCKET"
  value         = var.tf_state_bucket
}

resource "github_actions_variable" "tf_state_dynamodb_table_repo" {
  count         = var.tf_state_dynamodb_table != "" ? 1 : 0
  repository    = var.repository
  variable_name = "TF_STATE_DYNAMODB_TABLE"
  value         = var.tf_state_dynamodb_table
}

resource "github_actions_secret" "repo_aws_role_arn" {
  count           = var.create_repo_aws_role_secret ? 1 : 0
  repository      = var.repository
  secret_name     = "CI_AWS_ROLE_ARN"
  plaintext_value = var.aws_role_arn
}
