---
name: github-workflows
description: 'Work on GitHub Actions workflows in .github/workflows. Use when changing CI/CD sequencing, Terraform deploy automation, backend image build and push, frontend deploy automation, environment variables, secrets usage, workflow permissions, or bootstrap workflow dependencies.'
argument-hint: 'Describe the workflow, job, secret, environment variable, or deployment automation change to work on.'
---

# GitHub Workflows

Use this skill for CI/CD changes in `.github/workflows`.

## When to Use

- Change workflow YAML, job order, permissions, or environment handling.
- Update Terraform deployment automation or bootstrap flows.
- Modify backend image build/push automation.
- Modify frontend deployment to S3 and CloudFront.
- Investigate failures caused by missing secrets, repo variables, OIDC permissions, or workflow sequencing.

## Repository Context

- Workflow folder: `.github/workflows`
- Bootstrap workflows:
  - `0.1-onetime-provision-terraform-backend.yml`
  - `0.2-onetime-provision-github-oidc-secrets-variables.yml`
- Deployment workflows:
  - `1-deploy-infra.yml`
  - `2-backend-build-and-push.yml`
  - `3- frontend-deploy.yml`

## Working Rules

- Preserve the deployment order unless the task explicitly changes orchestration.
- If a workflow change depends on new AWS permissions, environment variables, or secrets, update the supporting Terraform/bootstrap definitions too.
- Keep environment names, secret names, and variable names consistent across workflows and Terraform.
- Prefer explicit permissions and minimal secret exposure.

## Procedure

1. Identify the workflow and job that directly controls the failing or requested behavior.
2. Read the dependent bootstrap or Terraform files only when the workflow contract points there.
3. Make the smallest workflow change that fixes sequencing, permissions, inputs, or deployment behavior.
4. Validate YAML shape and cross-file consistency.
5. If workflow permissions or environment contracts changed, verify the corresponding Terraform bootstrap modules.

## Validation

Use focused checks where available:

- Re-read the edited workflow for syntax and expression correctness.
- Verify referenced secrets, variables, and environment names exist in bootstrap Terraform or documentation.
- If the workflow invokes Terraform, ensure its inputs still match the Terraform modules.

## Common Checks

- Does the workflow still assume the correct OIDC role secret?
- Are environment-scoped variables and secrets still named consistently?
- Does the backend build still run after infrastructure dependencies are ready?
- Does the frontend deploy still depend on backend and environment outputs correctly?
- If permissions changed, did the bootstrap provisioning workflow and IAM module change too?

## Related Docs

- `.github/copilot-instructions.md`
- `terraform/bootstrap_orchestration/README.md`
- `terraform/ci_aws_oidc/README.md`
- `README.md`
