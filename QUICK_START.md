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
