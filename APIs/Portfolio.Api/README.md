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

## DynamoDB HTTP Response Cache

This API optionally uses a DynamoDB table as a simple HTTP response cache for portfolio responses and locales.

- Table name pattern: `{project}-{environment}-cache` (e.g. `portfolio-Beta-cache`).
- TTL is enabled on attribute `ExpiresAt` and items are set with a 24 hour expiry from write time.
- The API reads the table name from configuration key `DynamoCache:TableName` (see `APIs/Portfolio.Api/appsettings.Beta.json`).

Terraform:
- The DynamoDB resource is declared in `terraform/ecs.tf` as `aws_dynamodb_table.portfolio_cache`.
- The table is created with `PAY_PER_REQUEST` billing and `CacheKey` as the hash key.

IAM:
- ECS task role is granted `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:DeleteItem`, `dynamodb:Query`, `dynamodb:Scan`, `dynamodb:UpdateItem`, `dynamodb:BatchGetItem`, and `dynamodb:BatchWriteItem` against the table.

App behavior:
- The API will attempt to use the table when `DynamoCache:TableName` is configured and a DynamoDB client is available via DI.
- Cache keys:
	- Portfolio: `personId` (e.g. `alice123`)
	- Locale: `personId#language` (e.g. `alice123#en`)

Notes:
- Invalidate cache on portfolio create/update/delete, locale update/delete, and asset uploads/deletes.
- Ensure the environment-level appsettings (`appsettings.{Environment}.json`) includes the correct `DynamoCache:TableName` when deploying.
