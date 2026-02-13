output "variables_created" {
  description = "List of repo Actions variable names created"
  value = concat(
    [for k in keys(github_actions_environment_variable.s3_bucket_frontend_env) : "${k}:S3_BUCKET_FRONTEND"],
    [for k in keys(github_actions_environment_variable.tf_state_key_env) : "${k}:TF_STATE_KEY"],
    [for k in keys(github_actions_environment_variable.aws_region_env) : "${k}:AWS_REGION"],
    [for k in keys(github_actions_environment_variable.s3_bucket_name_env) : "${k}:S3_BUCKET_NAME"],
    [for k in keys(github_actions_environment_variable.ecs_task_cpu_env) : "${k}:ECS_TASK_CPU"],
    [for k in keys(github_actions_environment_variable.ecs_task_memory_env) : "${k}:ECS_TASK_MEMORY"],
    [for k in keys(github_actions_environment_variable.ecs_service_desired_count_env) : "${k}:ECS_SERVICE_DESIRED_COUNT"],
    var.tf_state_bucket != "" ? ["TF_STATE_BUCKET"] : [],
    var.tf_state_dynamodb_table != "" ? ["TF_STATE_DYNAMODB_TABLE"] : [],
    var.cognito_user_pool_id != "" ? ["COGNITO_USER_POOL_ID"] : [],
    var.cognito_user_pool_client_id != "" ? ["COGNITO_USER_POOL_CLIENT_ID"] : [],
    var.cognito_user_pool_domain != "" ? ["COGNITO_USER_POOL_DOMAIN"] : [],
  )
}

output "aws_role_secret_created" {
  description = "Whether CI_AWS_ROLE_ARN environment secret was created"
  value       = length(github_actions_secret.repo_aws_role_arn.*.id) > 0 ? true : false
}
