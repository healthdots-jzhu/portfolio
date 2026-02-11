# Quick Start Guide - Portfolio Management System

## Overall Repo Structure
As the code base grows, consider using separate repos for:
- Frontend application
- API application
- Terraform infrastructure

## For First-Time Setup

### 0. Run GitHub Actions workflows
Run in this order:
1. `0.1-onetime-provision-terraform-backend.yml`
2. `0.2-onetime-provision-github-oidc-secrets-variables.yml`
3. `1-deploy-infra.yml`

### 1. Run Database Migration
```powershell
Set-Location APIs/Portfolio.Api
dotnet ef database update
```

### 2. Start Backend API
```powershell
Set-Location APIs/Portfolio.Api
dotnet run
```

### 3. Start Frontend
```powershell
Set-Location portfolio-frontend
npm install
npm run dev
```

### 4. Run E2E Tests (Frontend)
Assumes the frontend dev server is already running at `http://localhost:5173`.
```powershell
Set-Location portfolio-frontend
npm run test:e2e
```
Notes:
- The public portfolio test hits `/p/jason-zhu-EU1O` and requires the API to be running (Step 2).
- Override the base URL with `E2E_BASE_URL` if needed.
- Login E2E uses these optional env vars (comma-separated lists; a random value is chosen each run):
  `E2E_LOGIN_EMAILS`, `E2E_LOGIN_PASSWORDS`, `E2E_LOGIN_FIRST_NAMES`, `E2E_LOGIN_LAST_NAMES`.
You can also create `portfolio-frontend/.env.e2e` and it will be loaded automatically by Playwright.

## Environment Variables
Frontend (`portfolio-frontend/.env`):
```
VITE_API_URL=https://api.healthdots.net/portfolio-__ENVIRONMENT__/content
VITE_CDN_URL=https://__CLOUDFRONT_DISTRIBUTION_ID__.cloudfront.net
```

Backend (`appsettings.json` or environment):
```
ConnectionStrings__Postgres=Host=...;Database=...;Username=...;Password=...
Aws__Region=ca-central-1
Aws__Cognito__Authority=https://cognito-idp.ca-central-1.amazonaws.com/{userPoolId}
Aws__Cognito__Audience__0={clientId}
```

## Testing the System (Example)
1. Login -> `/portfolios`
2. Edit portfolio -> Save changes
3. Create Version -> Stage -> Preview -> Publish
