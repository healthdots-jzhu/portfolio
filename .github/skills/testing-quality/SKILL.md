---
name: testing-quality
description: 'Run targeted validation and testing across backend, frontend, Terraform, and workflows. Use when selecting minimal tests for a change, validating fixes, checking regressions, or identifying missing test coverage.'
argument-hint: 'Describe the change and what behavior must be validated.'
---

# Testing and Quality

Use this skill for test strategy and validation across this monorepo.

## When to Use

- After implementing a feature, bug fix, refactor, or config change.
- When choosing the smallest test/build slice that still gives confidence.
- When triaging regressions and narrowing likely breakpoints.
- During code review to identify missing test coverage.

## Repository Context

- Backend API: `APIs/Portfolio.Api`
- Frontend app: `portfolio-frontend`
- Infrastructure: `terraform`
- CI workflows: `.github/workflows`

## Validation Strategy

Default to the narrowest relevant checks first, then expand only if risk is still unclear.

1. Scope the change surface: backend, frontend, infra, workflow, or mixed.
2. Run fast checks closest to the changed behavior.
3. Add broader checks only for contract, auth, routing, schema, or infra risk.
4. Report what was run, what was not run, and residual risk.

## Recommended Commands

Backend compile check:

```powershell
Set-Location APIs/Portfolio.Api
dotnet build
```

Frontend build check:

```powershell
Set-Location portfolio-frontend
npm run build
```

Frontend unit tests:

```powershell
Set-Location portfolio-frontend
npm run test:unit
```

Frontend E2E tests:

```powershell
Set-Location portfolio-frontend
npm run test:e2e
```

Terraform validation slice (when infra changed):

```powershell
Set-Location terraform
terraform init -reconfigure
terraform plan
```

## High-Risk Expansion Rules

Expand beyond minimal checks when changes touch:

- Auth, claims, or route contracts
- API/frontend integration surfaces
- Database schema/migrations
- Terraform state, IAM, or CI deployment wiring
- Resources protected by `prevent_destroy`

## Reporting Format

Always report:

- Checks run and pass/fail status
- Checks intentionally skipped
- Gaps and residual risk

If this is a review task, include missing tests as explicit findings.
