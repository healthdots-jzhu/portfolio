# Portfolio API - .NET 10 Backend

A .NET 10 Web API for managing portfolio owner accounts, content, and assets using AWS Cognito authentication and PostgreSQL storage.

## Features
- AWS Cognito Authentication
- Owner-scoped portfolios
- JSONB locale storage in PostgreSQL
- S3 asset management with CloudFront URLs
- Soft delete for portfolios
- EF Core migrations

## Configuration
See `appsettings.json` for required values:
- `Aws:Region`
- `Aws:Cognito:UserPoolId`, `ClientId`, `Authority`, `Audience`
- `Aws:S3:BucketName`
- `Aws:CloudFront:Domain`

## Running Locally
```powershell
Set-Location APIs/Portfolio.Api
dotnet run
```

## Deployment (AWS)
Terraform provisions:
- ALB with HTTPS listener
- ECS Fargate service for the API
- RDS PostgreSQL

ALB uses path-based routing: `/portfolio-{environment}/*` (see `terraform/ecs.tf`).

## API Endpoints
- `GET /api/health`
- `GET /api/portfolios/{personId}`
- `GET /api/portfolios/{personId}/locales/{language}`
- `POST /api/portfolios`
- `PUT /api/portfolios/{personId}/locales/{language}`
- `POST /api/portfolios/{personId}/assets/upload`

## Security Notes
- JWT tokens validated against Cognito
- S3 assets are private; served via CloudFront
- Requests restricted by owner claims
