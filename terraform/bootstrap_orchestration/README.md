# Bootstrap orchestration: create OIDC role and GitHub repo environment variables/secrets

This folder runs two local modules:

- `terraform/ci_aws_oidc` — creates an AWS IAM role assumable by GitHub Actions (OIDC) and attaches a CI policy.
- `terraform/github_provider` — creates GitHub Environments and repo-scoped/environment-scoped Actions variables/secrets.

## Prerequisites

- AWS credentials with permissions to create IAM roles/policies (e.g., `iam:CreateRole`, `iam:PutRolePolicy`, `iam:CreateOpenIDConnectProvider`). Either the running machine is attached an assumed role with these permissons, or you do a SSO login to aws with the role granted these permissions (EX: aws sso login --profile Admin-199061575177). In both cases temporary Access Key ID, Secret Access Key and Session token are issued. You may need to make them available in environment variables through the following commands:

```powershell
# Read the most recent SSO cache file and extract its access token
$cache = Get-ChildItem "$env:USERPROFILE\.aws\sso\cache" -Filter *.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$token = (Get-Content $cache.FullName | ConvertFrom-Json).accessToken

# Request role credentials using the cached access token and export them to the process env
$rc = aws sso get-role-credentials --account-id 199061575177 --role-name AdministratorAccess --access-token $token --query roleCredentials --output json | ConvertFrom-Json
$env:AWS_ACCESS_KEY_ID     = $rc.accessKeyId
$env:AWS_SECRET_ACCESS_KEY = $rc.secretAccessKey
$env:AWS_SESSION_TOKEN     = $rc.sessionToken
$env:AWS_REGION            = 'ca-central-1'
```

- Go to "GitHub Setings->Developer Settings->Personal access tokens" to generate a GitHub fine‑grained token with `Actions: Read & write` for the `healthdots-jzhu/portfolio` repository (preferred). Store it in the shell as `TF_VAR_github_token` for the session.

Recommended (single apply)
-
Use the provided tfvars file to create multiple environments in one apply. This prevents accidental resource replacement caused by single-environment fallbacks.

PowerShell (recommended):

```powershell
$env:TF_VAR_github_token = "{replace_with_actual_token}"
Set-Location terraform/bootstrap_orchestration

terraform init
terraform apply -var="github_token=$env:TF_VAR_github_token" -var="tf_state_bucket=healthdots-portfolio-terraform-state" -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" -var-file="bootstrap_environments.tfvars" -auto-approve
```

Two-step (optional)
-
If you prefer to create the CI role first, run a targeted apply for `module.ci_role`, then run a full apply with `bootstrap_environments.tfvars`. Example (provide repo-level TF state values):

```powershell
terraform init
terraform apply -target=module.ci_role -var="github_token=$env:TF_VAR_github_token" -var="tf_state_bucket=healthdots-portfolio-terraform-state" -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" -auto-approve
```

Then run the full apply:

```powershell
terraform apply -var="github_token=$env:TF_VAR_github_token" -var="tf_state_bucket=healthdots-portfolio-terraform-state" -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" -var-file="bootstrap_environments.tfvars" -auto-approve
```

PowerShell wrapper
-
There is an interactive helper `run-bootstrap.ps1` in this folder that prompts for the token and values, optionally runs the targeted role creation, then runs the full apply with `bootstrap_environments.tfvars`.

Usage:

```powershell
Set-Location terraform/bootstrap_orchestration
.\run-bootstrap.ps1
```

Notes and security
-
- Repository-level role secret: this orchestration now supports creating a single repository-scoped secret named `CI_AWS_ROLE_ARN`. To enable it set the orchestration variable `create_repo_aws_role_secret = true` (or pass `-var="create_repo_aws_role_secret=true"` to `terraform apply`). This stores the IAM role ARN at the repository scope instead of creating per-environment secrets.
- Repository-level TF state settings: if your S3 bucket and DynamoDB lock table are shared across environments (common case), set the orchestration variables `tf_state_bucket` and `tf_state_dynamodb_table` at the orchestration level; the module will create repository-scoped Actions variables `TF_STATE_BUCKET` and `TF_STATE_DYNAMODB_TABLE` from these values. Do not duplicate these values inside each environment entry in `bootstrap_environments.tfvars`.
- Keep tokens out of history and files; use short‑lived fine‑grained tokens where possible.
- For non-interactive automation prefer GitHub Actions OIDC or a GitHub App rather than personal tokens.

If you want, you can add a Bash wrapper or a `bootstrap_environments.auto.tfvars` template.

# Example Commands to re-import Terraform state

```powershell
terraform init -reconfigure `
  -backend-config="bucket=healthdots-portfolio-terraform-state" `
  -backend-config="key=portfolio/bootstrap.tfstate" `
  -backend-config="region=ca-central-1" `
  -backend-config="dynamodb_table=healthdots-portfolio-terraform-locks" `
  -backend-config="encrypt=true"

# Import role (use role NAME, not ARN)
terraform import `
  -var-file="bootstrap_environments.tfvars" `
  -var="github_owner=healthdots-jzhu" `
  -var="repository=portfolio" `
  -var="aws_account_id=199061575177" `
  -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
  -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
  -var="existing_oidc_provider_arn=arn:aws:iam::199061575177:oidc-provider/token.actions.githubusercontent.com" `
  module.ci_role.aws_iam_role.github_actions_role portfolio-github-actions-oidc-role

# Import policy (needs full ARN)
terraform import `
  -var-file="bootstrap_environments.tfvars" `
  -var="github_owner=healthdots-jzhu" `
  -var="repository=portfolio" `
  -var="aws_account_id=199061575177" `
  -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
  -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
  -var="existing_oidc_provider_arn=arn:aws:iam::199061575177:oidc-provider/token.actions.githubusercontent.com" `
  module.ci_role.aws_iam_policy.ci_policy arn:aws:iam::199061575177:policy/portfolio-github-actions-oidc-role-policy

# Import attachment (roleName/policyArn)
terraform import `
  -var-file="bootstrap_environments.tfvars" `
  -var="github_owner=healthdots-jzhu" `
  -var="repository=portfolio" `
  -var="aws_account_id=199061575177" `
  -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
  -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
  -var="existing_oidc_provider_arn=arn:aws:iam::199061575177:oidc-provider/token.actions.githubusercontent.com" `
  module.ci_role.aws_iam_role_policy_attachment.attach_ci_policy 'portfolio-github-actions-oidc-role/arn:aws:iam::199061575177:policy/portfolio-github-actions-oidc-role-policy'
  
```