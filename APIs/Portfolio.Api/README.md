# Portfolio API - .NET 10 Backend

A .NET 10 Web API for managing portfolio owner accounts, content, and assets using AWS Cognito authentication and PostgreSQL storage.

## Features

- **AWS Cognito Authentication**: JWT-based auth supporting social logins (Google, Apple, Microsoft, Facebook)
- **Owner-Scoped Portfolios**: Users manage only their own portfolios (1-to-many relationship)
- **JSONB Locale Storage**: Portfolio content stored in PostgreSQL with JSONB for flexible locale data
- **S3 Asset Management**: Upload images to S3 with CloudFront URLs
- **Soft Delete**: Portfolios deactivated via `IsActive` flag rather than physical deletion
- **EF Core Migrations**: Database schema managed through code-first migrations with SQL script generation

## Prerequisites

- .NET 10 SDK
- PostgreSQL database
- AWS Account with:
  - Cognito User Pool configured
  - S3 bucket (`healthdots-portfolio-web-app-001`)
  - CloudFront distribution

## Configuration

Update `appsettings.json` with your AWS and database credentials:

```json
{
  "ConnectionStrings": {
    "Postgres": "Host=YOUR_HOST;Port=5432;Database=portfolio;Username=YOUR_USER;Password=YOUR_PASSWORD"
  },
  "Aws": {
    "Region": "ca-central-1",
    "Cognito": {
      "UserPoolId": "YOUR_USER_POOL_ID",
      "ClientId": "YOUR_APP_CLIENT_ID",
      "Authority": "https://cognito-idp.ca-central-1.amazonaws.com/YOUR_USER_POOL_ID",
      "Audience": ["YOUR_APP_CLIENT_ID"]
    },
    "S3": {
      "BucketName": "healthdots-portfolio-web-app-001"
    },
    "CloudFront": {
      "Domain": "YOUR_DOMAIN.cloudfront.net"
    }
  }
}
```

## Database Setup

See [MIGRATIONS.md](MIGRATIONS.md) for full migration instructions.

```powershell
# Create initial migration
dotnet ef migrations add InitialCreate

# Generate SQL script for CI/CD
dotnet ef migrations script --idempotent -o Migrations/Scripts/InitialCreate.sql

# Apply migrations locally
dotnet ef database update
```

## Running the API

```powershell
cd C:\Users\zhuya\Code\portfolio\APIs\Portfolio.Api
dotnet run
```

API will be available at:
- HTTPS: https://localhost:7xxx
- HTTP: http://localhost:5xxx
- Swagger UI: https://localhost:7xxx/swagger

## API Endpoints

### Health
- `GET /api/health` - Health check

### Authentication
Authentication uses JWT tokens from AWS Cognito. Include token in requests:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

For development, use `X-Debug-UserId` header with a GUID.

### Portfolios
- `GET /api/portfolios` - List portfolios owned by authenticated user
- `GET /api/portfolios/{personId}` - Get public portfolio metadata
- `POST /api/portfolios` - Create new portfolio
- `PUT /api/portfolios/{personId}` - Update portfolio metadata
- `DELETE /api/portfolios/{personId}` - Soft-delete portfolio (sets IsActive=false)

### Locales
- `GET /api/portfolios/{personId}/locales/{language}` - Get locale content (public)
- `PUT /api/portfolios/{personId}/locales/{language}` - Update locale content (authenticated)

### Assets
- `POST /api/portfolios/{personId}/assets/upload` - Upload image asset
- `GET /api/portfolios/{personId}/assets` - List portfolio assets

## Development Notes

- **Dev Auth**: Use `X-Debug-UserId` header to bypass Cognito during local development
- **CORS**: Configured for `localhost:5173` (frontend dev server) and production CloudFront domain
- **File Uploads**: Max 5MB, allowed types: `.avif`, `.webp`, `.jpg`, `.jpeg`, `.png`, `.gif`
- **Soft Delete**: `IsActive` flag prevents deletion of portfolio data while hiding from public API

## Deployment

1. Generate migration SQL scripts
2. Apply scripts to RDS PostgreSQL via CI/CD
3. Deploy API to AWS (Elastic Beanstalk / ECS / Lambda)
4. Configure environment variables for production settings
5. Update CloudFront/ALB to route API requests

## Project Structure

```
Portfolio.Api/
 Controllers/         # API endpoint controllers
 Data/                # EF Core DbContext and configurations
 Models/              # Domain entities
    Dto/            # Data transfer objects
 Services/            # Business logic services
 Migrations/          # EF Core migration files
 appsettings.json     # Configuration
 Program.cs           # Application entry point
```

## Security

- JWT tokens validated against Cognito JWKs endpoint
- Owner-scoped data access enforced at controller level
- S3 assets uploaded with private ACL (served via CloudFront)
- SQL injection prevention via parameterized queries (EF Core)
- Request size limits enforced on file uploads

## License

Copyright  2025 HealthDots
