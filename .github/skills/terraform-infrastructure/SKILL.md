---
name: terraform-infrastructure
description: 'Work on the Terraform infrastructure in terraform. Use when changing AWS networking, ECS, ALB, RDS, Route53, IAM, Secrets Manager wiring, scheduler resources, bootstrap orchestration, remote state, or GitHub OIDC-related infrastructure configuration.'
argument-hint: 'Describe the infrastructure resource, module, workflow dependency, or environment behavior to work on.'
---

# Terraform Infrastructure

Use this skill for infrastructure work in `terraform`.

## When to Use

- Change AWS networking, VPC, subnets, ALB, ECS, RDS, Route53, IAM, KMS, Secrets Manager, or scheduler resources.
- Update ECS task definitions, runtime permissions, or environment-to-secret wiring.
- Modify bootstrap orchestration, GitHub OIDC, remote state, or environment variable provisioning.
- Investigate drift or deployment behavior rooted in Terraform configuration.

## Repository Context

- Main stack: `terraform/main.tf`, `terraform/ecs.tf`
- Variable contracts: `terraform/variables.tf`, `terraform/ecs_variables.tf`
- Remote state backend declaration: `terraform/backend.tf`
- State bootstrap and backend notes: `terraform/REMOTE_STATE.md`
- Bootstrap orchestration: `terraform/bootstrap_orchestration`
- GitHub OIDC role module: `terraform/ci_aws_oidc`
- GitHub provider module: `terraform/github_provider`

## Working Rules

- Treat Terraform edits as high-blast-radius changes.
- Call out `prevent_destroy` implications and state impact when changing protected resources.
- Treat remote state as part of infrastructure safety: S3 backend for state storage and DynamoDB for state locking.
- Keep API path routing aligned with ALB listener rules and backend `PATH_BASE` handling.
- If CI permissions, secrets, or repo/environment variables are affected, update bootstrap/orchestration and workflow assumptions together.
- Prefer scoped, explicit IAM permissions where practical.

## Procedure

1. Identify the resource, module, or variable contract that directly controls the behavior.
2. Read the nearest Terraform files that own that behavior, not the whole stack.
3. Make the minimal infrastructure change consistent with current patterns.
4. Validate syntax or plan scope if feasible.
5. If the change affects CI bootstrapping or deployment inputs, verify the dependent workflow and module surfaces.

## Validation

Run Terraform from the relevant folder when practical:

```powershell
Set-Location terraform
terraform init -reconfigure
terraform plan
```

When backend/state changes are involved, verify backend inputs are explicit and consistent:

```powershell
Set-Location terraform
terraform init -reconfigure `
	-backend-config="bucket=<tf-state-s3-bucket>" `
	-backend-config="key=portfolio/terraform.tfstate" `
	-backend-config="region=<aws-region>" `
	-backend-config="dynamodb_table=<tf-state-lock-table>" `
	-backend-config="encrypt=true"
```

For bootstrap changes:

```powershell
Set-Location terraform/bootstrap_orchestration
terraform init
terraform plan -var-file="bootstrap_environments.tfvars"
```

## Common Checks

- Does the change alter state shape, replacement behavior, or protected resources?
- Did remote state config remain valid: S3 bucket pathing, lock table name, and backend key conventions?
- Could this change break state locking or increase risk of concurrent applies?
- Are secret names and environment variable contracts still aligned with the app and workflows?
- Does ECS still have the right subnet, IAM, and secret access assumptions?
- If OIDC or CI permissions changed, does the bootstrap workflow still reconcile them?
- If ALB paths changed, does the backend routing contract still match?

## Related Docs

- `terraform/README.md`
- `terraform/REMOTE_STATE.md`
- `terraform/bootstrap_orchestration/README.md`
- `terraform/ci_aws_oidc/README.md`
- `SECRETS_MANAGER_SETUP.md`
