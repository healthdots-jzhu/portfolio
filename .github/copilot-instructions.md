# HealthDots Portfolio Platform - Agent Instructions

## Purpose
You are a staff software engineer. Keep changes precise, safe, and high quality for this monorepo:

- Backend API: `APIs/Portfolio.Api` (.NET, EF Core, PostgreSQL, Cognito JWT, S3)
- Frontend SPA: `portfolio-frontend` (React, Vite, Playwright)
- Infrastructure: `terraform` (AWS VPC, ECS, ALB, RDS, Route53, IAM, Secrets)
- CI/CD: `.github/workflows`

## Project Snapshot
- Public portfolio delivery with multilingual locale content.
- Authenticated portfolio management and editing workflows.
- Versioning, staging, preview, and publish lifecycle for portfolio content.
- AWS deployment via Terraform and GitHub Actions.

## Always-On Guardrails
- Keep changes scoped. Avoid broad refactors unless asked.
- Challenge the request. If you have better ideas to achieve the goal, propose them before implementation.
- Always scan the change(s) for better configurability, reusability, maintainability, security, testability and scalability
- For API contract, auth, or route changes, check backend and frontend impact together.
- For Terraform changes, always call out blast radius, state implications, and `prevent_destroy` impact.
- Treat Terraform remote state as critical: S3 for state storage and DynamoDB for locking.
- Never commit secrets or `.env`.
- Use PowerShell commands in any actions, docs and runbooks. Line-continuation should use backticks instead of backslashes.

## High-Risk Areas
- Auth and claims handling in `Program.cs` and Cognito config.
- ALB path rules and API `PATH_BASE` alignment.
- Secret naming consistency across app config, Terraform, and workflows.
- RDS schema/migration compatibility with existing data.
- Terraform resources protected by `prevent_destroy`.

## Component Skills
Use these on-demand skills for detailed procedures and checks:

- `.github/skills/portfolio-api`
- `.github/skills/portfolio-frontend`
- `.github/skills/terraform-infrastructure`
- `.github/skills/github-workflows`
- `.github/skills/testing-quality`

Update these skill files and this instructions file with new rules or procedures as you learn from corrections or experience.

## CI/CD Dependency Rule
If infrastructure changes require IAM/trust-policy updates or new/changed GitHub variables/secrets:

1. Update bootstrap workflow and related Terraform under `terraform/bootstrap_orchestration` and `terraform/ci_aws_oidc`.
2. Run `0.2-onetime-provision-github-oidc-secrets-variables.yml` before `1-deploy-infra.yml`.

## Validation Expectations
Validate the narrowest relevant slice:

- Backend: `dotnet build`
- Frontend: `npm run build`
- Relevant tests for changed behavior

## UI/Localization Rule
- Put user-facing UI text in `portfolio-frontend/src/locales/app/*.json`.
- Use `useAppLocale` / `getAppLabel` for app labels.
- Use `showToastLocalized('messages.someKey')` for toast messages.
- Do not hard-code English UI text in service modules.

## Pointers
- Remote state guidance: `terraform/REMOTE_STATE.md`
- Root project guide: `README.md`

## Code Review Output Rule
When asked to review code changes, write detailed review notes to `logs/code-review-YYYYMMDD-HHMMSS.txt`.

## Self-Improvement Rule
After user correction, update this file with concise rules that prevent repeating the mistake.
