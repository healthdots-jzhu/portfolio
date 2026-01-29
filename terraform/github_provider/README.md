# GitHub Provider: Repository Actions Variables & Secrets

Purpose
- Manage GitHub Actions repository-level variables (non-sensitive) and an optional environment-scoped secret (`CI_AWS_ROLE_ARN`) using the Terraform `github` provider. This is useful to keep environment-specific CI values under IaC control.

What this creates
- `TF_STATE_BUCKET`, `TF_STATE_KEY`, `TF_STATE_REGION`, `TF_STATE_DYNAMODB_TABLE`, `ECR_REGISTRY` as repository Actions variables.
 - Optional environment-scoped secret `CI_AWS_ROLE_ARN` when `aws_role_arn` is provided.

Required inputs
- `github_token` (env or var): a GitHub token with `repo` or `admin:repo_hook` privileges for the target repository.
- `github_owner`: owner or organization name.
- `repository`: repository name.
- `tf_state_bucket`, `tf_state_key`, `tf_state_region`, `tf_state_dynamodb_table`, `ecr_registry`.

Quick usage

1. Set up a token (example: create a personal access token with `repo` scope) and export it:

```powershell
$env:TF_VAR_github_token = "ghp_..."
```

2. Run Terraform in this folder:

```powershell
Set-Location terraform/github_provider
terraform init
terraform apply -auto-approve `
  -var="github_owner=your-org" `
  -var="repository=portfolio" `
  -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
  -var="tf_state_key=portfolio/terraform.tfstate" `
  -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
  -var="ecr_registry=199061575177.dkr.ecr.ca-central-1.amazonaws.com/healthdots-portfolio-api"
```

Notes
- The `github_actions_secret` resource stores the secret value securely in GitHub; do not include secret values in version control. Use CI/CD or secret management workflows to supply sensitive values.
- If you prefer to manage org-level variables, adapt resources to `github_actions_organization_variable`.
