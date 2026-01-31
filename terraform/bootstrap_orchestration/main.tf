module "ci_role" {
  source = "../ci_aws_oidc"

  aws_account_id         = var.aws_account_id
  github_owner           = var.github_owner
  github_repository      = var.repository
  # Use provided tf_state_bucket/table or fall back to repo+environment naming
  tf_state_bucket        = var.tf_state_bucket != "" ? var.tf_state_bucket : "${var.repository}-terraform-state-${var.environment}"
  tf_state_dynamodb_table = var.tf_state_dynamodb_table != "" ? var.tf_state_dynamodb_table : "${var.repository}-terraform-locks-${var.environment}"
  ecr_repository_arn     = var.ecr_repository_arn
  role_name              = var.role_name
  existing_oidc_provider_arn = var.existing_oidc_provider_arn
}

module "github_provider" {
  source = "../github_provider"

  github_token = var.github_token
  github_owner = var.github_owner
  repository   = var.repository

  # No computed defaults here — provide per-environment values via `environments` map.
  # The `environments` map must contain keys for: tf_state_bucket, tf_state_key,
  # aws_region, ecr_registry, and s3_bucket_frontend.
  aws_role_arn = module.ci_role.role_arn
  create_repo_aws_role_secret = var.create_repo_aws_role_secret
  tf_state_bucket = var.tf_state_bucket
  tf_state_dynamodb_table = var.tf_state_dynamodb_table
  environments = var.environments
}
