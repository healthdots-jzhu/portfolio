<#
PowerShell wrapper for terraform/bootstrap_orchestration
- Prompts for a fine-grained GitHub token and required orchestration vars
- Optionally runs a targeted apply to create the CI role first
- Runs a full apply using bootstrap_environments.tfvars
#>

# Read token securely and place in TF_VAR for the session
$secureToken = Read-Host -AsSecureString "Enter GitHub token (fine-grained token, Actions: Read & write)"
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
$githubToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
# Trim whitespace and remove surrounding quotes if present
$githubToken = $githubToken.Trim()
if ($githubToken.StartsWith('"') -and $githubToken.EndsWith('"')) { $githubToken = $githubToken.Trim('"') }
# Remove control characters and newlines which invalidate HTTP headers
$githubToken = $githubToken -replace '[\x00-\x1F\x7F]', ''
$githubToken = $githubToken.Trim()
# Basic validation
if ([string]::IsNullOrWhiteSpace($githubToken) -or $githubToken.Length -lt 10) {
  Write-Error "GitHub token appears empty or malformed. Aborting."
  exit 1
}
$env:TF_VAR_github_token = $githubToken

# Defaults (change as appropriate)
$defaultOwner = "healthdots-jzhu"
$defaultRepo = "portfolio"
$defaultAwsAccount = "199061575177"
$defaultStateBucket = "healthdots-portfolio-terraform-state"
$defaultDynamo = "healthdots-portfolio-terraform-locks"

# Prompt for values (enter to accept defaults)
$githubOwner = Read-Host "GitHub owner (press Enter for $defaultOwner)"
if ([string]::IsNullOrWhiteSpace($githubOwner)) { $githubOwner = $defaultOwner }
$repository = Read-Host "Repository (press Enter for $defaultRepo)"
if ([string]::IsNullOrWhiteSpace($repository)) { $repository = $defaultRepo }
$awsAccount = Read-Host "AWS account id (press Enter for $defaultAwsAccount)"
if ([string]::IsNullOrWhiteSpace($awsAccount)) { $awsAccount = $defaultAwsAccount }
$tfStateBucket = Read-Host "TF state bucket (press Enter for $defaultStateBucket)"
if ([string]::IsNullOrWhiteSpace($tfStateBucket)) { $tfStateBucket = $defaultStateBucket }
$tfDynamo = Read-Host "TF dynamodb table (press Enter for $defaultDynamo)"
if ([string]::IsNullOrWhiteSpace($tfDynamo)) { $tfDynamo = $defaultDynamo }

Write-Host "Using GitHub owner: $githubOwner, repo: $repository, aws account: $awsAccount"

# Require repository secret creation by default; we'll populate the ARN from module.ci_role
$env:TF_VAR_create_repo_aws_role_secret = 'true'

# Ensure we are in the orchestration folder
Push-Location (Join-Path $PSScriptRoot '.')

Write-Host "Running targeted apply for module.ci_role to produce CI role ARN..."
terraform init
if ($LASTEXITCODE -ne 0) {
  Write-Error "terraform init for targeted apply failed. Aborting bootstrap."
  Remove-Item env:TF_VAR_github_token -ErrorAction SilentlyContinue
  Pop-Location
  exit $LASTEXITCODE
}

terraform apply -target="module.ci_role" -var="github_owner=$githubOwner" -var="repository=$repository" -var="aws_account_id=$awsAccount" -var="tf_state_bucket=$tfStateBucket" -var="tf_state_dynamodb_table=$tfDynamo" -auto-approve
if ($LASTEXITCODE -ne 0) {
  Write-Error "Targeted terraform apply failed. Aborting bootstrap."
  Remove-Item env:TF_VAR_github_token -ErrorAction SilentlyContinue
  Pop-Location
  exit $LASTEXITCODE
}

# Capture the role ARN from the targeted apply and export it for the full apply
try {
  $roleArn = terraform output -raw role_arn 2>$null
  if (-not [string]::IsNullOrWhiteSpace($roleArn)) {
    $env:TF_VAR_aws_role_arn = $roleArn.Trim()
    Write-Host "Captured CI role ARN from terraform: $roleArn"
  } else {
    Write-Error "terraform output 'role_arn' returned empty. Aborting."
    Pop-Location
    exit 1
  }
} catch {
  Write-Error "Failed to read terraform output 'role_arn'. Aborting."
  Pop-Location
  exit 1
}

# Run the full apply using the sample tfvars file
Write-Host "Running full apply with bootstrap_environments.tfvars..."
terraform init
terraform apply -var="github_owner=$githubOwner" -var="repository=$repository" -var="aws_account_id=$awsAccount" -var="tf_state_bucket=$tfStateBucket" -var="tf_state_dynamodb_table=$tfDynamo" -var-file="bootstrap_environments.tfvars" -auto-approve

# Clear token and any TF_VARs we set for this session
Remove-Item env:TF_VAR_github_token -ErrorAction SilentlyContinue
Remove-Item env:TF_VAR_aws_role_arn -ErrorAction SilentlyContinue
Remove-Item env:TF_VAR_create_repo_aws_role_secret -ErrorAction SilentlyContinue

Pop-Location
Write-Host "Bootstrap orchestration finished. Verify GitHub Environments and Actions variables/secrets."