output "variables_created" {
  description = "List of repo Actions variable names created"
  value = concat(
    github_actions_environment_variable.s3_bucket_frontend_env.*.variable_name,
    github_actions_environment_variable.tf_state_bucket_env.*.variable_name,
    github_actions_environment_variable.tf_state_key_env.*.variable_name,
    github_actions_environment_variable.tf_state_region_env.*.variable_name,
    github_actions_environment_variable.tf_state_dynamodb_table_env.*.variable_name,
    github_actions_environment_variable.ecr_registry_env.*.variable_name,
  )
}

output "aws_role_secret_created" {
  description = "Whether CI_AWS_ROLE_ARN environment secret was created"
  value       = length(github_actions_environment_secret.aws_role_arn_env.*.id) > 0 ? true : false
}
