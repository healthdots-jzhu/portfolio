# PowerShell script to import GitHub resources into the bootstrap Terraform state
# Usage:
#   $env:TF_VAR_github_token = '<token>'
#   terraform init -reconfigure
#   .\import-github-resources.ps1



# Repository environments
$varFile = 'bootstrap_environments.tfvars'
$githubToken = $env:TF_VAR_github_token
$githubOwner = 'healthdots-jzhu'
$repository = 'portfolio'
$awsAccountId = '199061575177'
$tfStateBucket = 'healthdots-portfolio-terraform-state'
$tfStateDynamoTable = 'healthdots-portfolio-terraform-locks'
$oidcProviderArn = 'arn:aws:iam::199061575177:oidc-provider/token.actions.githubusercontent.com'

function Import-Res($address, $id) {
  Write-Host "Importing $address -> $id"
  $escapedAddress = $address -replace '"', '\"'
  $escapedId = $id -replace '"', '\"'
  & cmd /c "terraform import -var-file=$varFile -var=`"github_token=$githubToken`" -var=`"github_owner=$githubOwner`" -var=`"repository=$repository`" -var=`"aws_account_id=$awsAccountId`" -var=`"tf_state_bucket=$tfStateBucket`" -var=`"tf_state_dynamodb_table=$tfStateDynamoTable`" -var=`"existing_oidc_provider_arn=$oidcProviderArn`" `"$escapedAddress`" `"$escapedId`""
}

# Repository environments
Import-Res 'module.github_provider.github_repository_environment.env["staging"]' 'portfolio:staging'
Import-Res 'module.github_provider.github_repository_environment.env["beta"]'    'portfolio:beta'
Import-Res 'module.github_provider.github_repository_environment.env["prod"]'    'portfolio:prod'

# Environment-scoped variables (AWS_REGION)
Import-Res 'module.github_provider.github_actions_environment_variable.aws_region_env["staging"]' 'portfolio:staging:AWS_REGION'
Import-Res 'module.github_provider.github_actions_environment_variable.aws_region_env["beta"]'    'portfolio:beta:AWS_REGION'
Import-Res 'module.github_provider.github_actions_environment_variable.aws_region_env["prod"]'    'portfolio:prod:AWS_REGION'

# Environment-scoped variables (ECR_REGISTRY)
Import-Res 'module.github_provider.github_actions_environment_variable.ecr_registry_env["staging"]' 'portfolio:staging:ECR_REGISTRY'
Import-Res 'module.github_provider.github_actions_environment_variable.ecr_registry_env["beta"]'    'portfolio:beta:ECR_REGISTRY'
Import-Res 'module.github_provider.github_actions_environment_variable.ecr_registry_env["prod"]'    'portfolio:prod:ECR_REGISTRY'

# Environment-scoped variables (S3_BUCKET_FRONTEND)
Import-Res 'module.github_provider.github_actions_environment_variable.s3_bucket_frontend_env["staging"]' 'portfolio:staging:S3_BUCKET_FRONTEND'
Import-Res 'module.github_provider.github_actions_environment_variable.s3_bucket_frontend_env["beta"]'    'portfolio:beta:S3_BUCKET_FRONTEND'
Import-Res 'module.github_provider.github_actions_environment_variable.s3_bucket_frontend_env["prod"]'    'portfolio:prod:S3_BUCKET_FRONTEND'

# Environment-scoped variables (TF_STATE_KEY)
Import-Res 'module.github_provider.github_actions_environment_variable.tf_state_key_env["staging"]' 'portfolio:staging:TF_STATE_KEY'
Import-Res 'module.github_provider.github_actions_environment_variable.tf_state_key_env["beta"]'    'portfolio:beta:TF_STATE_KEY'
Import-Res 'module.github_provider.github_actions_environment_variable.tf_state_key_env["prod"]'    'portfolio:prod:TF_STATE_KEY'

# Repo-level variables (if present)
Import-Res 'module.github_provider.github_actions_variable.tf_state_bucket_repo[0]'         'portfolio:TF_STATE_BUCKET'
Import-Res 'module.github_provider.github_actions_variable.tf_state_dynamodb_table_repo[0]' 'portfolio:TF_STATE_DYNAMODB_TABLE'

# Repo-scoped secret (if used)
Import-Res 'module.github_provider.github_actions_secret.repo_aws_role_arn[0]' 'portfolio:CI_AWS_ROLE_ARN'

Write-Host "Imports complete. Run 'terraform state list' then 'terraform plan -var-file=\"bootstrap_environments.tfvars\"' to verify."