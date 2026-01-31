output "variables_created" {
  description = "List of repo Actions variable names created"
  value = concat(
    [for k in keys(github_actions_environment_variable.s3_bucket_frontend_env) : "${k}:S3_BUCKET_FRONTEND"],
    [for k in keys(github_actions_environment_variable.tf_state_key_env) : "${k}:TF_STATE_KEY"],
    [for k in keys(github_actions_environment_variable.aws_region_env) : "${k}:AWS_REGION"],
    [for k in keys(github_actions_environment_variable.ecr_registry_env) : "${k}:ECR_REGISTRY"],
    var.tf_state_bucket != "" ? ["TF_STATE_BUCKET"] : [],
    var.tf_state_dynamodb_table != "" ? ["TF_STATE_DYNAMODB_TABLE"] : [],
  )
}

output "aws_role_secret_created" {
  description = "Whether CI_AWS_ROLE_ARN environment secret was created"
  value       = length(github_actions_secret.repo_aws_role_arn.*.id) > 0 ? true : false
}
