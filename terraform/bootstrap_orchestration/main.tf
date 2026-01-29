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
}

module "github_provider" {
  source = "../github_provider"

  github_token = var.github_token
  github_owner = var.github_owner
  repository   = var.repository

  # Pass environment and computed defaults (allow overrides via orchestration vars)
  environment            = var.environment
  tf_state_bucket        = var.tf_state_bucket != "" ? var.tf_state_bucket : "${var.repository}-terraform-state-${var.environment}"
  tf_state_key           = var.tf_state_key != "" ? var.tf_state_key : "${var.repository}/${var.environment}/terraform.tfstate"
  tf_state_region        = var.tf_state_region
  tf_state_dynamodb_table = var.tf_state_dynamodb_table != "" ? var.tf_state_dynamodb_table : "${var.repository}-terraform-locks-${var.environment}"
  ecr_registry           = var.ecr_registry != "" ? var.ecr_registry : "${var.repository}-${var.environment}"
  aws_role_arn = module.ci_role.role_arn
  create_aws_role_secret = var.create_aws_role_secret
}
