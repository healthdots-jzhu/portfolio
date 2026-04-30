# HealthDots Portfolio Platform

HealthDots Portfolio Platform is a monorepo for a production-oriented portfolio system with a React frontend, an ASP.NET Core API, and AWS infrastructure managed with Terraform.

The platform supports public portfolio delivery, authenticated portfolio management, localized content, asset storage, and environment-aware deployment paths.

## What Is In This Repository

- `portfolio-frontend`: React + Vite single-page application with Playwright end-to-end tests.
- `APIs/Portfolio.Api`: ASP.NET Core Web API using EF Core, PostgreSQL, Cognito JWT auth, and AWS integrations.
- `terraform`: AWS infrastructure for networking, ECS Fargate, ALB, RDS, Route53, secrets wiring, and scheduling.
- `.github/workflows`: CI/CD workflows for bootstrap, infrastructure deployment, backend image publishing, and frontend deployment.

## Architecture Overview

- Frontend is built with Vite and deployed to S3 behind CloudFront.
- Backend API runs on ECS Fargate behind an Application Load Balancer.
- PostgreSQL stores portfolio, locale, asset, and management data.
- AWS Cognito provides JWT-based authentication for protected operations.
- Portfolio assets are stored in S3 and returned through CloudFront URLs.
- API routing is environment-aware and expects a path base shaped like `/portfolio-{environment}/content/*`.

## Monorepo Layout

```text
.
|- APIs/Portfolio.Api           ASP.NET Core API and EF Core migrations
|- portfolio-frontend          React application and tests
|- terraform                   AWS infrastructure as code
|- .github/workflows           CI/CD workflows
|- docker-compose.yml          Local API container run
|- QUICK_START.md              Short setup flow
|- README.dev.docker.md        Docker-based API run notes
```

## Core Capabilities

- Public portfolio content delivery by `personId` and language.
- Authenticated portfolio ownership and editing flows.
- Multi-language locale management.
- Asset upload and CDN-backed delivery.
- Versioning, staging, preview, and publishing workflows for portfolio content.
- Infrastructure deployment through GitHub Actions and Terraform.

## Local Development

### Prerequisites

- .NET SDK 10
- Node.js and npm
- PostgreSQL access
- AWS credentials for any flow that touches S3, SSM, Secrets Manager, or Cognito-backed resources
- Terraform if you need to work on infrastructure

### Backend API

```powershell
Set-Location APIs/Portfolio.Api
dotnet run
```

Apply migrations when needed:

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

Useful frontend commands:

```powershell
Set-Location portfolio-frontend
npm run build
npm run test:e2e
npm run test:unit
```

Notes:

- Playwright defaults to `http://localhost:5173`.
- Override the e2e target with `E2E_BASE_URL` when testing against another environment.
- Some end-to-end scenarios require the backend API to be available.

### API In Docker

The repository includes a compose setup for running the API in a container while pointing at an external database.

```powershell
docker compose up --build
```

Before doing that:

1. Copy `.env.example` to `.env`.
2. Fill in the database connection string and AWS-related values.

Important details:

- Compose runs the API only. It does not provision a database.
- The API listens on `http://localhost:5000` through the compose mapping.
- `.env` is only a template source for substitution unless variables are explicitly mapped into the container.

## Configuration Notes

### Backend

The API relies on standard .NET configuration binding, so JSON keys map to environment variables using double underscores.

Examples:

- `ConnectionStrings:Postgres` -> `ConnectionStrings__Postgres`
- `Aws:Region` -> `Aws__Region`
- `Aws:S3:BucketName` -> `Aws__S3__BucketName`
- `Hashids:ParameterName` -> `Hashids__ParameterName`

Repository-specific behavior:

- `Program.cs` checks `ConnectionStrings__Postgres` before `ConnectionStrings:Postgres`.
- `PATH_BASE` is respected via `UsePathBase`, which matters for ALB path routing.
- Cognito JWT settings come from `Aws:Cognito:*` configuration.
- CORS is set up for `localhost` and `*.healthdots.net` origins.

### Frontend

The frontend commonly uses these environment values:

```env
VITE_API_URL=https://api.healthdots.net/portfolio-__ENVIRONMENT__/content
VITE_CDN_URL=https://__CLOUDFRONT_DISTRIBUTION_ID__.cloudfront.net
```

## Deployment Model

### Runtime Topology

- Frontend static assets are deployed separately from the API.
- Backend is containerized and published to ECR, then deployed to ECS.
- Infrastructure is provisioned and updated with Terraform.
- Secrets are expected to come from GitHub environment secrets, AWS Secrets Manager, SSM parameters, or IAM roles.

### GitHub Actions Workflow Order

Run or understand these workflows in this sequence:

1. `0.1-onetime-provision-terraform-backend.yml`
2. `0.2-onetime-provision-github-oidc-secrets-variables.yml`
3. `1-deploy-infra.yml`
4. `2-backend-build-and-push.yml`
5. `3- frontend-deploy.yml`

Additional operational workflows are also present for destroy and recreate scenarios.

## Terraform Notes

The Terraform stack provisions the main AWS footprint, including:

- VPC and subnet layout
- ECS cluster and service
- Application Load Balancer and listener rules
- PostgreSQL on RDS
- ECR repository
- Secrets and supporting IAM resources
- Scheduler-related infrastructure

Important constraints:

- Several resources are protected with `prevent_destroy = true`.
- ECS tasks read named secrets from Secrets Manager.
- HTTPS listener creation depends on ACM certificate configuration.
- Path-based routing must stay aligned with API `PATH_BASE` handling.

## Repository Docs Worth Reading

- `QUICK_START.md` for the shortest setup path.
- `README.dev.docker.md` for container-based API development.
- `APIs/Portfolio.Api/README.md` for backend-specific setup and API notes.
- `portfolio-frontend/FRONTEND_INTEGRATION.md` for frontend API integration details.
- `terraform/README.md` for infrastructure usage.
- `PORTFOLIO_MANAGEMENT_GUIDE.md` for portfolio editor and publishing workflows.

## High-Risk Areas

Be careful when changing:

- Cognito auth and JWT claim handling.
- ALB path base and API routing.
- Secret names shared across app configuration, Terraform, and CI workflows.
- Database schema and migrations against non-empty environments.
- Terraform resources guarded from destruction.

## Suggested Validation Commands

Use the narrowest relevant checks for the slice you changed:

```powershell
Set-Location APIs/Portfolio.Api
dotnet build
```

```powershell
Set-Location portfolio-frontend
npm run build
```

```powershell
Set-Location portfolio-frontend
npm run test:e2e
```

## Security Expectations

- Do not commit `.env` or any real secrets.
- Prefer IAM roles, Secrets Manager, and SSM over raw credentials.
- Treat GitHub environment secrets and bootstrap workflows as part of the deployment contract.

## Status

This repository already contains the application code, infrastructure definitions, migration utilities, and deployment workflows needed to run the platform across local and AWS-backed environments. The root README is intended to be the entry point; component-specific details remain in their own folders and docs.