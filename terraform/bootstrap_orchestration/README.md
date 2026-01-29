# Bootstrap orchestration: create OIDC role and GitHub repo variables/secrets

This orchestration runs two local modules in sequence:

- `terraform/ci_aws_oidc` — creates an AWS IAM role assumable by GitHub Actions (OIDC) and attaches a CI policy.
- `terraform/github_provider` — creates repository Actions variables (and optionally stores the role ARN as a secret).

Usage

1. Ensure you have AWS credentials with permissions to create IAM roles/policies and GitHub token with repo admin rights.

2. Run the orchestration with appropriate variables (example):

```powershell
Set-Location terraform/bootstrap_orchestration
terraform init
terraform apply -auto-approve `
  -var="github_token=<GITHUB_TOKEN>" `
  -var="github_owner=healthdots-jzhu" `
  -var="repository=portfolio" `
  -var="aws_account_id=123456789012" `
  -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
  -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
  -var="ecr_registry=199061575177.dkr.ecr.ca-central-1.amazonaws.com/healthdots-portfolio-api"
```

What happens
- Terraform will create the OIDC role and CI policy and output the role ARN.
  - The GitHub provider will then create Actions variables for `TF_STATE_BUCKET`, `TF_STATE_KEY`, `TF_STATE_REGION`, `TF_STATE_DYNAMODB_TABLE`, and `ECR_REGISTRY` in the target repository. If `github_provider.aws_role_arn` is set via the module variable, it will create an environment-scoped secret `CI_AWS_ROLE_ARN` with the role ARN.

  Two-step run (when creating role + secret)
  -------------------------------------------------
  If you want the orchestration to create the CI role and then create the GitHub environment secret that contains the role ARN, run the bootstrap in two steps:

  1) Create the CI role (first apply):

  ```powershell
   # Set token only in current shell
   $env:TF_VAR_github_token = '<YOUR_FINE_GRAINED_TOKEN>'

   Set-Location terraform/bootstrap_orchestration
   terraform init
   terraform apply -target=module.ci_role `
    -var="github_token=$env:TF_VAR_github_token" `
    -var="github_owner=healthdots-jzhu" `
    -var="repository=portfolio" `
    -var="aws_account_id=199061575177" `
    -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
    -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
    -auto-approve
  ```

  2) Create GitHub environment variables and the `CI_AWS_ROLE_ARN` secret (second apply):

  ```powershell
  terraform apply `
    -var="github_token=$env:TF_VAR_github_token" `
    -var="github_owner=healthdots-jzhu" `
    -var="repository=portfolio" `
    -var="aws_account_id=199061575177" `
    -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
    -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
    -var="create_aws_role_secret=true" `
    -auto-approve
  ```

  The `create_aws_role_secret` flag (added to the orchestration) ensures the environment-scoped secret is only created once the role ARN is available from the first run.

  3) Repeat for additional environments
  ------------------------------------
  To create variables/secrets for other environments (for example `staging` or `prod`), run the second apply again with the target `environment` value and the `create_aws_role_secret` flag set. Example for `staging`:

  ```powershell
  terraform apply `
    -var="github_token=$env:TF_VAR_github_token" `
    -var="github_owner=healthdots-jzhu" `
    -var="repository=portfolio" `
    -var="aws_account_id=199061575177" `
    -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
    -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
    -var="environment=staging" `
    -var="create_aws_role_secret=true" `
    -auto-approve
  ```

  Repeat with `-var="environment=prod"` for production values.

Notes
- The orchestration expects the module paths to be correct relative to this folder.
- You must supply `github_token` with sufficient privileges (personal token) or configure the GitHub provider accordingly.
- Review and tighten IAM policy and OIDC subject conditions for production.

**GitHub token guidance (scopes, creation, usage, security)**

- Minimum scopes (recommended):
  - Fine‑grained personal access token (preferred):
    - Repository access: select the single repository `healthdots-jzhu/portfolio`.
    - Repository permissions: `Actions: Read & write` (required to create/update Actions variables and repository secrets). Optionally `Contents: Read` for metadata.
    - Set a short expiration (e.g., 7 days) and rotate after bootstrap.
  - Classic PAT (only if fine‑grained is not available):
    - Scope: `repo` (full control of private repositories). This covers repository variables/secrets.
    - For org-level operations, add `admin:org` (use sparingly).

- Why these permissions:
  - Creating repository Actions variables and repo secrets requires repository-level write access to the Actions API; `Actions: Read & write` (fine‑grained) or `repo` (classic) are the practical minimums.
  - Prefer restricting access to a single repository and using short expiry to reduce blast radius.

- Create a fine‑grained token (recommended):
  1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine‑grained tokens → Generate new token.
  2. Set "Repository access" → Select repositories → choose `healthdots-jzhu/portfolio`.
  3. Under "Repository permissions" grant `Actions: Read & write` (and `Contents: Read` if needed).
  4. Set an expiration (short), generate the token, and copy it immediately.

- Example usage (PowerShell, temporary env var for current shell):
  ```powershell
  Set-Location terraform/bootstrap_orchestration
  # Set token only in current shell
  $env:TF_VAR_github_token = '<YOUR_FINE_GRAINED_TOKEN>'

  terraform init
  terraform apply -auto-approve `
    -var="github_owner=healthdots-jzhu" `
    -var="repository=portfolio" `
    -var="github_token=$env:TF_VAR_github_token" `
    -var="aws_account_id=123456789012" `
    -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
    -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
    -var="ecr_registry=199061575177.dkr.ecr.ca-central-1.amazonaws.com/healthdots-portfolio-api"
  ```
  - Passing `-var="github_token=<PAT>"` is supported but less secure (token appears in command history).

- Security best practices:
  - Use a fine‑grained token limited to the single repo instead of a classic `repo` token where possible.
  - Use a short expiry (rotate immediately after bootstrap) and revoke the token once the orchestration completes.
  - Do not store the token in git or commit it to files. Use the shell, a local secrets manager, or a secure environment variable store.
  - After bootstrap, prefer the AWS OIDC role for CI; the orchestration creates `CI_AWS_ROLE_ARN` in the repo environment so Actions can use OIDC instead of a PAT.

- Alternatives to using a PAT:
  - Use a GitHub App with repository installation token (recommended for automation with least privilege).
  - Run the orchestration from a controlled admin machine or ephemeral CI job that has elevated rights, then revoke those rights afterwards.

- AWS credential note:
  - The bootstrap requires AWS credentials that can create IAM roles/policies (e.g., `iam:CreateRole`, `iam:PutRolePolicy`, `iam:CreateOpenIDConnectProvider`, `iam:AttachRolePolicy`). Ensure the principal you run the orchestration with has those permissions.

If you want, I can add an example PowerShell snippet to securely fetch a temporary PAT from a local secret manager (e.g., `SecretManagement`) and run the orchestration automatically.

**AWS SSO: recommended usage (do NOT parse SSO cache files)**

- Use `aws sso login` to obtain interactive SSO credentials and let the AWS CLI/SDK handle caching and refresh. Do not instruct users to read or parse the SSO cache file — its format and rotation are internal and brittle.

- Example PowerShell flow (interactive):
  ```powershell
  # Log in interactively (opens browser if needed)
  aws sso login --profile Admin-199061575177

  # Make the profile available to Terraform and AWS SDKs in this shell
  $env:AWS_PROFILE = 'Admin-199061575177'
  $env:AWS_SDK_LOAD_CONFIG = '1'

  # Optional check
  aws sts get-caller-identity

  # Then run orchestration (example assumes TF_VAR_github_token is set)
  Set-Location terraform/bootstrap_orchestration
  terraform init
  terraform apply -auto-approve `
    -var="github_token=$env:TF_VAR_github_token" `
    -var="github_owner=healthdots-jzhu" `
    -var="repository=portfolio" `
    -var="aws_account_id=199061575177" `
    -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
    -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks"
  ```

- Notes and best practices:
  - Do not read or parse the SSO cache file to extract temporary tokens — this is insecure and fragile.
  - Tokens expire; re-run `aws sso login` to refresh as needed.
  - For fully automated, non-interactive runs prefer GitHub Actions OIDC, a GitHub App, or a short‑lived service principal/role rather than trying to script SSO cache extraction.
  - If you must run unattended within your environment, consider using an AWS IAM user with temporary credentials stored in a secure vault (rotate and revoke after bootstrap) — avoid embedding long‑lived credentials in repo or CI.
