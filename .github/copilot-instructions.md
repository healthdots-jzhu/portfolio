# HealthDots Portfolio Platform - README

## Purpose
You are a staff software engineer with deep knowledge in system design, architecture, common patterns and best practices to make the highest quality changes. This repository contains a full-stack portfolio platform with:
- Backend API: `APIs/Portfolio.Api` (.NET 10, EF Core, PostgreSQL, Cognito JWT auth, S3 assets)
- Frontend SPA: `portfolio-frontend` (React + Vite + Playwright)
- Infrastructure as code: `terraform` (AWS VPC, ECS Fargate, ALB, RDS, Route53, Secrets Manager integration, scheduler)
- CI/CD workflows: `.github/workflows`

## Monorepo Structure
- `APIs/Portfolio.Api`: ASP.NET Core API, EF Core migrations, business services, Dockerfile.
- `portfolio-frontend`: React application, Vite build, Playwright e2e tests.
- `terraform`: Main AWS stack and related bootstrap/OIDC sub-stacks.
- `.github/workflows`: Infra deploy, backend image build/push, frontend S3+CloudFront deploy.
- `docker-compose.yml`: Local API container run.

## Runtime Architecture
- Frontend served from S3 behind CloudFront.
- API runs on ECS Fargate behind ALB + Route53.
- API path base is environment-specific: `/portfolio-{environment}/content/*`.
- API expects JWT auth via AWS Cognito and persists data in RDS PostgreSQL.
- Assets are stored in S3 and exposed via CloudFront URL in API responses.
- API pulls secrets from AWS Secrets Manager and Hashids salt from SSM Parameter Store (if configured).

## Local Development (PowerShell)
### Backend
```powershell
Set-Location APIs/Portfolio.Api
dotnet run
```

### Backend migrations
```powershell
Set-Location APIs/Portfolio.Api
dotnet ef database update
```

### Frontend
```powershell
Set-Location portfolio-frontend
npm install
npm run dev
```

### Frontend E2E tests
```powershell
Set-Location portfolio-frontend
npm run test:e2e
```
Notes:
- Playwright base URL defaults to `http://localhost:5173` (override with `E2E_BASE_URL`).
- Some e2e tests require API availability.

### Docker-based API run
```powershell
docker compose up --build
```
- Uses `.env` values for container environment mapping.
- DB is expected to be external (for example RDS), not provisioned by compose.

## Key Backend Conventions
- `Program.cs` reads `ConnectionStrings__Postgres` first, then `ConnectionStrings:Postgres`.
- Cognito JWT configuration comes from `Aws:Cognito:*` settings.
- `PATH_BASE` env var is respected via `UsePathBase` for ALB path routing.
- CORS allows `*.healthdots.net` and `localhost` origins.
- AWS SDK clients are created with optional profile/region resolution.
- `GitHubModels__ApiToken` can be injected via secret/env.

## Key Frontend Conventions
- Build tool: Vite (`npm run build`).
- Deployment env file writes:
  - `VITE_API_URL=https://api.healthdots.net/portfolio-{env}/content`
  - `VITE_CDN_URL=https://<cloudfront_distribution_id>.cloudfront.net`
- E2E config is in `portfolio-frontend/playwright.config.js`.

## Terraform Topology
Primary stack files:
- `terraform/main.tf`: VPC/networking, RDS, EC2 bastion-like SSM host, VPC endpoints, ECR, KMS, scheduler.
- `terraform/ecs.tf`: ECS cluster/service/task, ALB/listeners/rules, Route53 record, task IAM and secrets wiring.
- `terraform/variables.tf` + `terraform/ecs_variables.tf`: core and ECS variable contracts.

Important behavior:
- Many resources use `prevent_destroy = true`.
- ECS task reads secret values by name from Secrets Manager:
  - `${project_name}-${environment}-postgres-connection`
  - `${project_name}-${environment}-github-models-token`
- ALB HTTPS listener is created only if `acm_certificate_arns` is non-empty.
- ECS path routing expects `/portfolio-{environment}/content/*`.

## CI/CD Workflows (order and intent)
1. `0.1-onetime-provision-terraform-backend.yml`
2. `0.2-onetime-provision-github-oidc-secrets-variables.yml`
3. `1-deploy-infra.yml` (terraform plan/apply)
4. `2-backend-build-and-push.yml` (Docker build + push to ECR)
5. `3- frontend-deploy.yml` (frontend build + S3 sync + CloudFront invalidation)

Workflow design notes:
- AWS auth is via GitHub OIDC role assumption.
- Backend workflow waits for infra workflow health.
- Frontend workflow waits for backend workflow health.
- Terraform plans are uploaded to S3 for audit trail.

## CI Assume Role Dependency
- `terraform/ci_aws_oidc/main.tf` defines the GitHub OIDC-assumable CI IAM role and attached policies used by infra deployment.
- `.github/workflows/1-deploy-infra.yml` assumes this role (`secrets.CI_AWS_ROLE_ARN`) via `aws-actions/configure-aws-credentials` to run Terraform plan/apply.
- If infrastructure changes require additional AWS IAM permissions, trust-policy changes, or new/changed GitHub repository/environment variables or secrets, you must:
  1. Update `.github/workflows/0.2-onetime-provision-github-oidc-secrets-variables.yml` (and related bootstrap Terraform under `terraform/bootstrap_orchestration` / `terraform/ci_aws_oidc` as needed).
  2. Run `0.2-onetime-provision-github-oidc-secrets-variables.yml` to reconcile CI role permissions and GitHub secrets/variables before running `1-deploy-infra.yml`.
## Environment and Secrets
- Use `.env.example` as local template.
- Never commit `.env` or real secrets.
- Preferred runtime secret sources: GitHub environment secrets, AWS Secrets Manager, SSM parameters, IAM roles.

## Agent Guardrails for This Repo
- Keep changes scoped; avoid broad refactors unless requested.
- When modifying API contract or routing, verify both backend and frontend impact.
- When changing Terraform, call out blast radius, state implications, and `prevent_destroy` constraints.
- Validate locally where practical:
  - Backend compiles (`dotnet build`)
  - Frontend builds (`npm run build`)
  - Relevant tests pass
- Use PowerShell command style in documentation and runbooks.

## Additional UI/localization guidance for the assistant
- Always place user-facing text in the locale JSON files under `src/locales/app/*.json` and reference those keys from code (use `useAppLocale` or `getAppLabel`).
- Use the shared toast utility at `src/utils/toast.js` for transient UI messages (use `showToastLocalized('messages.someKey')`).
- Do not hard-code English strings in service modules; fetch localized labels before showing UI text.
- For UI changes, read more instructions in `portfolio-frontend/.github/copilot-instructions.md`

## High-Risk Areas
- Auth and claim handling (`Program.cs`, Cognito config).
- Path base and ALB listener-rule alignment.
- Secret name consistency between Terraform, workflows, and app config.
- RDS/DB migration compatibility with production data.
- Terraform resources guarded by `prevent_destroy`.

## Self- Improvement Loop
- After any correction from the user, update this copilot instructions file (copilot-instructions.md) to reflect the new guidance.
- Write rules for yourself that prevent the same mistakes in the future.
- Research the existing codebase of the relevant components (backend, frontend, infrastructure) and find possibilities to refactor existing code to improve reusability, flexibility, maintainability and consistency before suggesting changes. For example, if the change is potentially applicable to other areas or future features, check if there are existing utilities, patterns or abstractions in both codebases that can be leveraged to implement the change in a way that benefits all relevant components. Refactor existing code to extract common logic, create reusable components or services, and ensure that the new implementation follows established conventions and best practices in the codebase. This will help to prevent code duplication, reduce technical debt, and make future changes easier to implement.

## Code Review
- When you are asked to review the code changes, output the detailed review notes into a txt file in the logs folder. Name the file with the current timestamp following "code-review-" pattern, for example: `logs/code-review-20240601-120000.txt`.
