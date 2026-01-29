# CI AWS OIDC Role + Policy

Purpose
- Create an AWS IAM role that GitHub Actions can assume using OIDC (token.actions.githubusercontent.com). The role includes a minimal policy granting permissions typically needed by CI: ECR image push and Terraform remote state access (S3 + DynamoDB).

What this creates
- `aws_iam_openid_connect_provider` for GitHub Actions (if not present).
- `aws_iam_role` with a trust policy limited to the specified GitHub repository (subject matches `repo:<owner>/<repo>:ref:refs/heads/*`).
- IAM policy granting ECR, S3, and DynamoDB permissions attached to the role.

Important variables
- `aws_account_id` — target AWS account ID.
- `github_owner` and `github_repository` — used to restrict the OIDC subject.
- `tf_state_bucket`, `tf_state_dynamodb_table` — used to scope S3/DynamoDB permissions for Terraform state.
- `ecr_repository_arn` (optional) — provide to further restrict ECR permissions to a single repository ARN.

Quick usage

```powershell
Set-Location terraform/ci_aws_oidc
terraform init
terraform apply -auto-approve `
  -var="aws_account_id=123456789012" `
  -var="github_owner=healthdots-jzhu" `
  -var="github_repository=portfolio" `
  -var="tf_state_bucket=healthdots-portfolio-terraform-state" `
  -var="tf_state_dynamodb_table=healthdots-portfolio-terraform-locks" `
  -var="ecr_repository_arn=arn:aws:ecr:ca-central-1:123456789012:repository/healthdots-portfolio-api"
```

Outputs
- `role_arn` — use this value as the environment-scoped secret `CI_AWS_ROLE_ARN` or directly reference in CI workflows.

Security notes
- The trust policy is now restricted to the `master` branch by default (`refs/heads/master`). Adjust `data.aws_iam_policy_document.assume_role_policy` in `main.tf` if you need different branch or tag restrictions.
- The ECR permissions in the example policy are broad; provide `ecr_repository_arn` to narrow scope.
