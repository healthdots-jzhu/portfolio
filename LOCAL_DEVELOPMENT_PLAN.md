# Local Development Plan: AWS-Independent Setup

**Date:** June 3, 2026  
**Objective:** Enable local development (laptop or Docker) without AWS dependencies, while preserving production AWS deployment capability.

---

## Executive Summary

This plan transforms the portfolio platform to support **three operational modes**:

1. **Local Laptop Development** - Direct execution with mocked/local AWS services
2. **Local Docker Development** - Containerized stack with compose-managed services
3. **AWS Cloud (Beta/Production)** - Unchanged Terraform deployment flow

**Key Insight:** Most AWS services can be mocked or replaced without code changes, only configuration.

---

## Phase 1: Discovery & Architecture Decisions

### Current AWS Dependencies Analysis

| Service | Purpose | Local Alternative | Priority |
|---------|---------|-------------------|----------|
| **Cognito** | User authentication | Keep AWS (requires internet) | ⚠️ Constraint |
| **RDS PostgreSQL** | Application database | Local PostgreSQL container | 🟢 Easy |
| **S3** | File storage | MinIO container | 🟢 Easy |
| **DynamoDB** | Response cache | dynamodb-local container | 🟢 Easy |
| **CloudFront** | CDN for assets | Direct S3/MinIO access | 🟢 Easy |
| **Secrets Manager** | Secret storage | Environment variables | 🟢 Easy |
| **SSM Parameter Store** | Config storage | appsettings.json | 🟢 Easy |
| **GitHub Models API** | AI content generation | Mock HTTP service | 🟢 Medium |
| **ECS/ECR** | Container orchestration | Docker Compose | 🟢 Easy |
| **ALB/Route53** | DNS/routing | Local port forwarding | 🟢 Easy |

### Configuration Layering Strategy

```
┌─────────────────────────────────────────────────────────┐
│ Environment-Specific Behavior (No code changes needed)   │
├─────────────────────────────────────────────────────────┤
│ appsettings.Development.json (local overrides)          │
│ appsettings.Docker.json (Docker-specific)               │
│ appsettings.Beta/Staging/Prod.json (AWS cloud)          │
│                      +                                   │
│ Environment variables (injected at runtime)             │
│ Secrets Manager / SSM (AWS cloud only)                  │
└─────────────────────────────────────────────────────────┘
```

**Philosophy:** Use .NET configuration providers to cascade settings from local→Docker→Cloud without code changes.

---

## Phase 2: Backend Configuration Changes

### 2.1 Create Docker-Specific Configuration File

**File:** `APIs/Portfolio.Api/appsettings.Docker.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  },
  "ConnectionStrings": {
    "Postgres": "Host=postgres;Port=5432;Database=portfoliodb;Username=portfolio_user;Password=portfolio_password;SslMode=Disable"
  },
  "Aws": {
    "Region": "localhost",
    "Cognito": {
      "Authority": "https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_cRS3mcP7U",
      "Audience": ["4ligvh2gi6e7713i72dgob118u"]
    },
    "S3": {
      "BucketName": "portfolio-dev",
      "ServiceUrl": "http://minio:9000"
    },
    "CloudFront": {
      "Domain": "http://minio:9000"
    }
  },
  "DynamoCache": {
    "Enabled": true,
    "ServiceUrl": "http://dynamodb-local:8000",
    "Tables": {
      "LocalesCache": {
        "TableName": "portfolio-dev-cache",
        "EnableCompression": true
      }
    }
  },
  "Hashids": {
    "Salt": "local-dev-salt-change-in-prod"
  },
  "GitHubModels": {
    "Enabled": false,
    "ApiToken": "mock-token-local-dev",
    "MockResponses": true
  },
  "Auth": {
    "JwtValidation": true
  }
}
```

### 2.2 Update Development Configuration

**File:** `APIs/Portfolio.Api/appsettings.Development.json` (enhance existing)

```json
{
  "ConnectionStrings": {
    "Postgres": "Host=localhost;Port=5432;Database=portfoliodb;Username=portfolio_user;Password=portfolio_password;SslMode=Disable"
  },
  "Aws": {
    "Region": "ca-central-1",
    "S3": {
      "BucketName": "portfolio-dev",
      "ServiceUrl": "http://localhost:9000"
    },
    "CloudFront": {
      "Domain": "http://localhost:9000"
    }
  },
  "DynamoCache": {
    "Enabled": true,
    "ServiceUrl": "http://localhost:8000",
    "Tables": {
      "LocalesCache": {
        "TableName": "portfolio-dev-cache",
        "EnableCompression": false
      }
    }
  },
  "Hashids": {
    "Salt": "local-dev-salt-please-change"
  },
  "GitHubModels": {
    "Enabled": false,
    "MockResponses": true,
    "ApiToken": "mock-token"
  }
}
```

### 2.3 Update Program.cs to Support Local Services

**Key Changes:**

1. **Conditional AWS Service Registration:**

```csharp
var awsRegion = builder.Configuration["Aws:Region"];
var isDynamoDisabled = builder.Configuration.GetValue<bool>("DynamoCache:Disabled", false);

// S3 Client with optional custom service URL (for MinIO)
var s3ServiceUrl = builder.Configuration["Aws:S3:ServiceUrl"];
var s3Config = new AmazonS3Config { ServiceURL = s3ServiceUrl };
var s3Client = new AmazonS3Client(credentials, s3Config);

// DynamoDB Client with optional local endpoint
if (!isDynamoDisabled && awsRegion != "localhost")
{
    var dynamoServiceUrl = builder.Configuration["DynamoCache:ServiceUrl"];
    var dynamoConfig = new AmazonDynamoDBConfig 
    { 
        ServiceURL = dynamoServiceUrl ?? "http://localhost:8000"
    };
    var dynamoClient = new AmazonDynamoDBClient(credentials, dynamoConfig);
    builder.Services.AddSingleton<IAmazonDynamoDB>(dynamoClient);
}
```

2. **Mock GitHub Models Service for Local Dev:**

```csharp
var gitHubModelsEnabled = builder.Configuration.GetValue<bool>("GitHubModels:Enabled", false);
if (gitHubModelsEnabled)
{
    builder.Services.AddScoped<IGitHubModelsService, GitHubModelsService>();
}
else
{
    builder.Services.AddScoped<IGitHubModelsService, MockGitHubModelsService>();
}
```

3. **JWT Validation Toggle (optional, for testing without Cognito):**

```csharp
var validateJwt = builder.Configuration.GetValue<bool>("Auth:JwtValidation", true);
if (validateJwt)
{
    // Register real JWT bearer authentication
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(/* ... existing config ... */);
}
else
{
    // Register mock authentication for local testing
    builder.Services.AddAuthentication("Development")
        .AddScheme<AuthenticationSchemeOptions, MockAuthenticationHandler>("Development", null);
}
```

### 2.4 Create Mock Services

**File:** `APIs/Portfolio.Api/Services/MockGitHubModelsService.cs`

```csharp
public class MockGitHubModelsService : IGitHubModelsService
{
    private readonly ILogger<MockGitHubModelsService> _logger;

    public MockGitHubModelsService(ILogger<MockGitHubModelsService> logger)
    {
        _logger = logger;
    }

    public async Task<string> GenerateLocalizedContentAsync(
        string language, 
        Dictionary<string, object> context, 
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Mock GitHub Models: Generating {Language} content", language);
        
        // Return mock content matching expected schema
        return JsonSerializer.Serialize(new
        {
            summary = $"Mock portfolio summary in {language}",
            highlights = new[] { "Mock highlight 1", "Mock highlight 2" },
            generated = DateTime.UtcNow
        });
    }
}
```

**File:** `APIs/Portfolio.Api/Middleware/MockAuthenticationHandler.cs`

```csharp
public class MockAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public MockAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder) 
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Create test user identity
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "local-test-user-id"),
            new Claim("sub", "local-test-user-sub"),
            new Claim(ClaimTypes.Email, "test@local.dev"),
            new Claim("email_verified", "true")
        };
        
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

### 2.5 Update S3 Service for MinIO

**File:** `APIs/Portfolio.Api/Services/S3Service.cs` (enhance existing)

```csharp
public class S3Service
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly string _cloudFrontDomain;

    public async Task<string> GetAssetUrlAsync(string s3Key)
    {
        // Use CloudFront domain if configured (production)
        // Use direct S3/MinIO URL if no CloudFront (local dev)
        if (_cloudFrontDomain.Contains("cloudfront"))
        {
            return $"{_cloudFrontDomain}/{s3Key}";
        }
        else
        {
            // MinIO or local S3: use direct URL
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _bucketName,
                Key = s3Key,
                Expires = DateTime.UtcNow.AddHours(1) // Short-lived local URLs
            };
            return _s3Client.GetPreSignedURL(request);
        }
    }
}
```

---

## Phase 3: Frontend Configuration Changes

### 3.1 Create Environment Configuration

**File:** `portfolio-frontend/.env.development`

```
VITE_API_URL=http://localhost:5000
VITE_AUTH_DOMAIN=YOUR_LOCAL_COGNITO_DOMAIN
VITE_AUTH_CLIENT_ID=4ligvh2gi6e7713i72dgob118u
VITE_AUTH_REDIRECT_PATH=/callback
```

**File:** `portfolio-frontend/.env.docker`

```
VITE_API_URL=http://api:80
VITE_AUTH_DOMAIN=YOUR_COGNITO_DOMAIN
VITE_AUTH_CLIENT_ID=4ligvh2gi6e7713i72dgob118u
```

**File:** `portfolio-frontend/.env.production`

```
VITE_API_URL=https://api.healthdots.net
VITE_AUTH_DOMAIN=healthdots.auth.ca-central-1.amazoncognito.com
VITE_AUTH_CLIENT_ID=4ligvh2gi6e7713i72dgob118u
```

### 3.2 Update Vite Config

**File:** `portfolio-frontend/vite.config.js` (add environment support)

```javascript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL || 'http://localhost:5000'),
      __AUTH_DOMAIN__: JSON.stringify(env.VITE_AUTH_DOMAIN || ''),
      __AUTH_CLIENT_ID__: JSON.stringify(env.VITE_AUTH_CLIENT_ID || '')
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5000',
          changeOrigin: true
        }
      }
    }
  };
});
```

### 3.3 Update API Service

**File:** `portfolio-frontend/src/services/portfolioApi.js`

```javascript
const API_BASE_URL = window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Ensure proper error handling for local dev
export const uploadAsset = async (personId, file, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/portfolios/${personId}/assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: file
    });
    
    if (!response.ok) {
      console.error('Upload failed:', await response.text());
    }
    
    return response.json();
  } catch (error) {
    console.error('API call failed - ensure backend is running', error);
    throw error;
  }
};
```

---

## Phase 4: Docker Compose Enhancement

### 4.1 Update docker-compose.yml

**File:** `docker-compose.yml` (complete rewrite for full local stack)

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: portfolio-postgres
    environment:
      POSTGRES_DB: portfoliodb
      POSTGRES_USER: portfolio_user
      POSTGRES_PASSWORD: portfolio_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U portfolio_user"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - portfolio-network

  # MinIO (S3 Alternative)
  minio:
    image: minio/minio:latest
    container_name: portfolio-minio
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    ports:
      - "9000:9000"
      - "9001:9001"  # MinIO Console
    volumes:
      - minio_data:/minio_data
    command: server /minio_data --console-address ":9001"
    networks:
      - portfolio-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

  # DynamoDB Local
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    container_name: portfolio-dynamodb
    ports:
      - "8000:8000"
    volumes:
      - dynamodb_data:/home/dynamodblocal/data
    command: "-jar DynamoDBLocal.jar -sharedDb -dbPath /home/dynamodblocal/data"
    networks:
      - portfolio-network
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  # DynamoDB Admin UI (optional)
  dynamodb-admin:
    image: aaronshaf/dynamodb-admin:latest
    container_name: portfolio-dynamodb-admin
    ports:
      - "8001:8001"
    environment:
      DYNAMODB_ENDPOINT: http://dynamodb-local:8000
    depends_on:
      - dynamodb-local
    networks:
      - portfolio-network

  # Portfolio API Backend
  api:
    build:
      context: ./APIs/Portfolio.Api
      dockerfile: Dockerfile
    container_name: portfolio-api
    environment:
      ASPNETCORE_ENVIRONMENT: Docker
      ASPNETCORE_URLS: http://+:80
      ConnectionStrings__Postgres: "Host=postgres;Port=5432;Database=portfoliodb;Username=portfolio_user;Password=portfolio_password;SslMode=Disable"
      Aws__Region: localhost
      Aws__S3__BucketName: portfolio-dev
      Aws__S3__ServiceUrl: http://minio:9000
      Aws__CloudFront__Domain: http://minio:9000
      DynamoCache__Enabled: "true"
      DynamoCache__ServiceUrl: http://dynamodb-local:8000
      DynamoCache__Tables__LocalesCache__TableName: portfolio-dev-cache
      Hashids__Salt: ${HASHIDS_SALT:-local-dev-salt}
      GitHubModels__Enabled: "false"
      GitHubModels__MockResponses: "true"
      Auth__JwtValidation: "false"
    ports:
      - "5000:80"
    depends_on:
      postgres:
        condition: service_healthy
      dynamodb-local:
        condition: service_healthy
      minio:
        condition: service_healthy
    volumes:
      - ./APIs/Portfolio.Api:/app/src
    networks:
      - portfolio-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/api/v1/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Frontend (optional for compose, usually run separately during dev)
  frontend:
    build:
      context: ./portfolio-frontend
      dockerfile: Dockerfile
    container_name: portfolio-frontend
    environment:
      VITE_API_URL: http://api:80
    ports:
      - "5173:5173"
    depends_on:
      - api
    volumes:
      - ./portfolio-frontend/src:/app/src
    networks:
      - portfolio-network

volumes:
  postgres_data:
  minio_data:
  dynamodb_data:

networks:
  portfolio-network:
    driver: bridge
```

### 4.2 Create MinIO Initialization Script

**File:** `docker/init-minio.sh`

```bash
#!/bin/bash
set -e

# Wait for MinIO to start
sleep 5

# Create bucket using MinIO client
mc alias set minio http://minio:9000 minioadmin minioadmin123
mc mb minio/portfolio-dev --ignore-existing
mc anonymous set public minio/portfolio-dev/img  # Allow public read for uploaded images

echo "MinIO initialized successfully"
```

**File:** `docker-compose.yml` (add init service)

```yaml
minio-init:
  image: minio/mc:latest
  container_name: portfolio-minio-init
  entrypoint: >
    /bin/sh -c "
    /usr/bin/mc alias set minio http://minio:9000 minioadmin minioadmin123;
    /usr/bin/mc mb minio/portfolio-dev --ignore-existing;
    /usr/bin/mc anonymous set public minio/portfolio-dev/img;
    echo 'MinIO initialized';
    "
  depends_on:
    - minio
  networks:
    - portfolio-network
```

### 4.3 Create DynamoDB Table Initialization

**File:** `docker/init-dynamodb.sh`

```bash
#!/bin/bash
set -e

aws dynamodb create-table \
  --endpoint-url http://dynamodb-local:8000 \
  --table-name portfolio-dev-cache \
  --attribute-definitions AttributeName=CacheKey,AttributeType=S \
  --key-schema AttributeName=CacheKey,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region localhost 2>/dev/null || echo "Table already exists"

aws dynamodb update-time-to-live \
  --endpoint-url http://dynamodb-local:8000 \
  --table-name portfolio-dev-cache \
  --time-to-live-specification AttributeName=ExpiresAt,Enabled=true \
  --region localhost 2>/dev/null || echo "TTL already configured"

echo "DynamoDB initialized"
```

**Integration:** Add to Dockerfile or API initialization code:

```csharp
// In Program.cs, after services configured
using (var scope = app.Services.CreateScope())
{
    var dynamoDb = scope.ServiceProvider.GetRequiredService<IAmazonDynamoDB>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        await dynamoDb.CreateTableAsync(new CreateTableRequest
        {
            TableName = "portfolio-dev-cache",
            AttributeDefinitions = new[] 
            {
                new AttributeDefinition { AttributeName = "CacheKey", AttributeType = "S" }
            },
            KeySchema = new[] 
            {
                new KeySchemaElement { AttributeName = "CacheKey", KeyType = "HASH" }
            },
            BillingMode = "PAY_PER_REQUEST"
        });
        
        logger.LogInformation("DynamoDB table created");
    }
    catch (ResourceInUseException)
    {
        logger.LogInformation("DynamoDB table already exists");
    }
}
```

---

## Phase 5: Database Migrations & Schema Setup

### 5.1 Update Migration Strategy

**Current Issue:** Migrations target AWS RDS  
**Solution:** Support both local PostgreSQL and RDS

**File:** `APIs/Portfolio.Api/Data/DbContextFactory.cs` (create for migrations)

```csharp
public class PortfolioDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json")
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        var connectionString = configuration.GetConnectionString("Postgres");
        optionsBuilder.UseNpgsql(connectionString);

        return new AppDbContext(optionsBuilder.Options);
    }
}
```

### 5.2 Initialization Script

**File:** `scripts/init-local-db.ps1`

```powershell
# Stop on any error
$ErrorActionPreference = "Stop"

Write-Host "🔄 Initializing local PostgreSQL database..."

# Ensure Docker PostgreSQL is running
docker-compose up -d postgres
Start-Sleep -Seconds 5

# Apply migrations
Write-Host "📦 Applying EF Core migrations..."
Set-Location ./APIs/Portfolio.Api
dotnet ef database update --configuration Development
Set-Location ../..

# Seed sample data (optional)
Write-Host "🌱 Seeding sample data..."
# TODO: Create seed data script

Write-Host "✅ Database initialized successfully!"
Write-Host "📊 Connect with: psql -h localhost -U portfolio_user -d portfoliodb"
```

---

## Phase 6: Local Development Workflow

### 6.1 Laptop Development Setup

**Prerequisites:**
- .NET 10.0 SDK
- Node.js 18+
- Docker & Docker Compose (for dependent services)
- PostgreSQL client (psql)

**Startup Script:** `scripts/start-local-dev.ps1`

```powershell
param(
    [switch]$UseDocker = $false,
    [switch]$SkipMigrations = $false
)

Write-Host "🚀 Starting Portfolio Platform Local Dev..."

if ($UseDocker) {
    Write-Host "🐳 Starting Docker services..."
    docker-compose up -d postgres minio dynamodb-local dynamodb-admin
    Start-Sleep -Seconds 10
}

if (-not $SkipMigrations) {
    Write-Host "📦 Applying database migrations..."
    & ./scripts/init-local-db.ps1
}

Write-Host ""
Write-Host "🎯 Starting services..."
Write-Host ""

# Option 1: Run API and Frontend separately in same terminal
Write-Host "Option 1: Run all in same window (foreground)"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

# Start API (watch mode)
Write-Host "Starting API on http://localhost:5000..."
$ApiProcess = Start-Process -NoNewWindow -PassThru -FilePath "dotnet" -ArgumentList @(
    "watch",
    "run",
    "--project", "./APIs/Portfolio.Api/Portfolio.Api.csproj"
)

Start-Sleep -Seconds 3

# Start Frontend (separate window)
Write-Host "Starting Frontend on http://localhost:5173..."
Push-Location ./portfolio-frontend
$FrontendProcess = Start-Process -NoNewWindow -PassThru -FilePath "npm" -ArgumentList @("run", "dev")
Pop-Location

Write-Host ""
Write-Host "✅ Services started!"
Write-Host ""
Write-Host "📱 Frontend: http://localhost:5173"
Write-Host "🔌 API: http://localhost:5000"
Write-Host "💾 PostgreSQL: localhost:5432"
Write-Host "📦 MinIO Console: http://localhost:9001 (admin/minioadmin123)"
Write-Host "📊 DynamoDB Admin: http://localhost:8001"
Write-Host ""
Write-Host "⚠️  Press Ctrl+C to stop all services"

# Wait for processes
$ApiProcess | Wait-Process
$FrontendProcess | Wait-Process
```

**Usage:**
```powershell
# Run with Docker services
./scripts/start-local-dev.ps1 -UseDocker

# Run with local services (assumes PostgreSQL running)
./scripts/start-local-dev.ps1

# Skip migrations
./scripts/start-local-dev.ps1 -SkipMigrations
```

### 6.2 Docker Development Setup

**Single Command:**
```bash
docker-compose up
```

**Access:**
- Frontend: http://localhost:5173
- API: http://localhost:5000
- MinIO Console: http://localhost:9001
- DynamoDB Admin: http://localhost:8001

### 6.3 Development Environment Files

**File:** `README.dev.local.md` (create new)

```markdown
# Local Development Guide

## Prerequisites
- .NET 10.0 SDK
- Node.js 18+
- Docker Desktop (for local services)

## Quick Start

### Option 1: Laptop Development (all services in Docker)

1. Start Docker services:
   ```powershell
   docker-compose up -d
   ```

2. Initialize database:
   ```powershell
   ./scripts/init-local-db.ps1
   ```

3. Start API (watch mode):
   ```powershell
   cd APIs/Portfolio.Api
   dotnet watch run
   ```

4. In another terminal, start frontend:
   ```powershell
   cd portfolio-frontend
   npm install
   npm run dev
   ```

5. Open http://localhost:5173

### Option 2: Full Docker Stack

```powershell
docker-compose up --build
```

All services start automatically. Access:
- Frontend: http://localhost:5173
- API: http://localhost:5000
- MinIO: http://localhost:9001 (admin/minioadmin123)
- DynamoDB: http://localhost:8001

### Environment Variables

**For local laptop dev**, create `.env.local`:

```
ASPNETCORE_ENVIRONMENT=Development
ConnectionStrings__Postgres=Host=localhost;Port=5432;Database=portfoliodb;Username=portfolio_user;Password=portfolio_password;SslMode=Disable
Aws__Region=localhost
Aws__S3__ServiceUrl=http://localhost:9000
DynamoCache__ServiceUrl=http://localhost:8000
GitHubModels__MockResponses=true
Auth__JwtValidation=false
```

### Database Management

**Connect to local PostgreSQL:**
```bash
psql -h localhost -U portfolio_user -d portfoliodb
```

**Run migrations:**
```powershell
cd APIs/Portfolio.Api
dotnet ef database update
```

**Reset database:**
```powershell
docker-compose down -v postgres
docker-compose up -d postgres
./scripts/init-local-db.ps1
```

### File Uploads

Local uploads go to MinIO:
- Console: http://localhost:9001
- Default creds: admin / minioadmin123
- Bucket: `portfolio-dev`

### Authentication

For local dev, authentication is **disabled by default** (`Auth__JwtValidation=false`).

To test with real Cognito:
1. Set `Auth__JwtValidation=true` in appsettings.Development.json
2. Configure Cognito OAuth redirect to `http://localhost:5173/callback`
3. Frontend will prompt Cognito login flow

### Testing API Directly

**Without auth:**
```bash
curl -X GET http://localhost:5000/api/v1/portfolios/test
```

**With mock auth header:**
```bash
curl -X GET http://localhost:5000/api/v1/portfolios/test \
  -H "Authorization: Bearer mock-token"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Connection refused: localhost:5432` | Ensure `docker-compose up -d` ran successfully |
| `AAPT0000: Failed to resolve: minio` | Docker DNS issue; restart Docker Desktop |
| `Frontend can't reach API` | Check `VITE_API_URL` in .env; should be `http://localhost:5000` |
| `JWT validation fails` | Set `Auth__JwtValidation=false` for local dev |

## Deployment Pipeline (Unchanged)

Local changes do not affect AWS deployment:
1. Push to GitHub `main` branch
2. GitHub Actions triggers Terraform deploy
3. Production deployment uses real AWS services (Cognito, RDS, S3, etc.)

See `TERRAFORM_DEPLOYMENT.md` for cloud deployment details.
```

---

## Phase 7: GitHub Actions & CI/CD Preservation

### 7.1 Update Workflows (Preserve Existing)

**No changes needed to existing workflows:**
- `.github/workflows/1-deploy-infra.yml` - Continues to deploy Terraform to AWS
- `.github/workflows/2-backend-build-and-push.yml` - Continues to build Docker image for ECR
- `.github/workflows/3-frontend-deploy.yml` - Continues to deploy to S3/CloudFront

**New Optional Workflow:** `.github/workflows/4-run-local-tests.yml`

```yaml
name: Local Integration Tests

on:
  pull_request:
    paths:
      - 'APIs/Portfolio.Api/**'
      - 'portfolio-frontend/**'
      - 'docker-compose.yml'

jobs:
  test-local-stack:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: portfoliodb
          POSTGRES_USER: portfolio_user
          POSTGRES_PASSWORD: portfolio_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '10.0.x'
      
      - name: Build API
        run: dotnet build APIs/Portfolio.Api/Portfolio.Api.csproj
      
      - name: Run API Tests (if exist)
        run: dotnet test APIs/Portfolio.Api --logger "console;verbosity=detailed"
        continue-on-error: true
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: portfolio-frontend/package-lock.json
      
      - name: Build Frontend
        run: |
          cd portfolio-frontend
          npm ci
          npm run build
```

### 7.2 Environment Matrix

**Update workflows to support multiple environments:**

```yaml
strategy:
  matrix:
    environment: [local, docker, staging, prod]
```

---

## Phase 8: Terraform Infrastructure (Unchanged)

**No Terraform changes required.** Infrastructure deployment remains unchanged:

- Remote state in S3 + DynamoDB locking
- VPC, RDS, DynamoDB, S3, CloudFront
- ECS Fargate, ALB, Route53
- IAM roles, Secrets Manager integration
- GitHub OIDC authentication

**Production deployments continue to use real AWS services.**

---

## Phase 9: Implementation Sequence

### Week 1: Backend Configuration
- [ ] Create `appsettings.Docker.json`
- [ ] Create `appsettings.Development.json` (enhancement)
- [ ] Update `Program.cs` with conditional service registration
- [ ] Create `MockGitHubModelsService.cs`
- [ ] Create `MockAuthenticationHandler.cs`
- [ ] Test locally with environment variables

### Week 2: Frontend & Docker Compose
- [ ] Create `.env.development` and `.env.docker`
- [ ] Update `vite.config.js` for environment support
- [ ] Update `portfolioApi.js` for local error handling
- [ ] Create/update comprehensive `docker-compose.yml`
- [ ] Create MinIO initialization script
- [ ] Create DynamoDB initialization logic

### Week 3: Database & Scripts
- [ ] Create `DbContextFactory.cs` for migrations
- [ ] Create `init-local-db.ps1` script
- [ ] Create `start-local-dev.ps1` script
- [ ] Create `README.dev.local.md` documentation
- [ ] Test full local Docker stack

### Week 4: Testing & Validation
- [ ] Test laptop development (with Docker services)
- [ ] Test full Docker Compose stack
- [ ] Validate Cognito integration (optional)
- [ ] Test file uploads to MinIO
- [ ] Run integration tests
- [ ] Verify AWS deployment pipeline still works
- [ ] Update existing documentation

### Week 5: CI/CD & Polish
- [ ] Create local test workflow (GitHub Actions)
- [ ] Add diagnostics and troubleshooting guide
- [ ] Document known limitations
- [ ] Performance testing (local vs cloud)
- [ ] Update team onboarding documentation

---

## Phase 10: Limitations & Constraints

### 1. Cognito Authentication (AWS-Only)

**Why:** OAuth flow requires internet-connected Cognito service

**Options for Testing:**
1. Disable JWT validation in local dev (`Auth__JwtValidation=false`) ✅ Easiest
2. Use real Cognito with redirects to `http://localhost:5173/callback` ✅ Recommended
3. Implement OIDC mock server (OpenID Connect emulator) ⚠️ Complex

**Recommendation:** Use option 2 for production-like testing, option 1 for rapid iteration

### 2. S3 Permissions Model

**Current:** Private S3 objects, CloudFront with OAC  
**Local:** MinIO with public bucket or signed URLs

**Impact:** File access patterns differ slightly locally vs production

### 3. Performance Differences

| Service | Local | AWS | Difference |
|---------|-------|-----|-----------|
| RDS Latency | <1ms | ~5-10ms | Negligible |
| S3/MinIO Upload | ~50ms | ~100ms | Slightly faster |
| DynamoDB/Local | <1ms | ~10ms | Much faster (good for testing) |
| Network | Direct | Internet | Better throughput locally |

### 4. GitHub Models API

**Current:** Real API calls to `models.github.ai`  
**Local:** Mocked responses (can't test real AI features locally)

**Workaround:** Keep `GitHubModels__Enabled=false` for local, real API in cloud

---

## Phase 11: Cost Analysis

### Local Development (Laptop + Docker)
- **Cost:** $0 (uses computer resources)
- **Dependencies:** Docker Desktop (free community edition)

### Local Development (Cloud-Based Docker)
- **Example:** Azure Container Instances for remote execution
- **Cost:** ~$0.05/hour per container (~$36/month for 24/7 dev box)
- **Benefit:** Access from anywhere, consistent environment

### Production AWS Deployment
- **Current:** ~$150-300/month (varies with traffic)
- **Unchanged:** Terraform continues managing cloud infrastructure
- **Note:** Local dev does NOT incur AWS costs

---

## Phase 12: Success Criteria & Validation

### ✅ Acceptance Tests

**Backend:**
- [ ] API starts with `dotnet run` (Development config)
- [ ] API starts in Docker with `docker-compose up`
- [ ] Database migrations run automatically
- [ ] Endpoints respond without Cognito (mock auth)
- [ ] S3 uploads work with MinIO
- [ ] DynamoDB caching works (local)
- [ ] GitHub Models calls use mock service

**Frontend:**
- [ ] App builds with `npm run build`
- [ ] App runs with `npm run dev`
- [ ] API calls succeed with local backend
- [ ] Authentication flow works (Cognito or mock)
- [ ] File uploads display correctly
- [ ] Environment variables inject correctly

**Docker:**
- [ ] `docker-compose up` starts all services
- [ ] All services pass health checks
- [ ] Services communicate across network
- [ ] Data persists in volumes

**AWS Deployment:**
- [ ] Terraform deployment unchanged
- [ ] GitHub Actions workflows still work
- [ ] Production environment unaffected
- [ ] Staging/Beta environments work correctly

---

## Phase 13: Documentation Deliverables

### 1. Developer Guide
- **File:** `README.dev.local.md`
- **Content:** Quick start, environment setup, troubleshooting

### 2. Architecture Decision Record
- **File:** `LOCAL_DEV_DECISIONS.md`
- **Content:** Why each choice was made, alternatives considered

### 3. Configuration Reference
- **File:** `CONFIG_REFERENCE.md`
- **Content:** All environment variables, settings, feature flags

### 4. Service Mapping
- **File:** `SERVICE_MAPPING.md`
- **Content:** How local services map to AWS (S3→MinIO, DynamoDB→local, etc.)

### 5. Troubleshooting Guide
- **File:** `TROUBLESHOOTING.md`
- **Content:** Common issues and solutions

---

## Appendix A: Environment Variable Reference

### Backend Configuration

```
# Database
ConnectionStrings__Postgres=Host=localhost;Port=5432;Database=portfoliodb;Username=portfolio_user;Password=portfolio_password;SslMode=Disable

# AWS / Local Services
Aws__Region=ca-central-1 (or 'localhost' for local dev)
Aws__S3__BucketName=portfolio-dev
Aws__S3__ServiceUrl=http://minio:9000 (local) or blank (AWS)
Aws__CloudFront__Domain=http://minio:9000 (local) or https://dc274vt0tzx97.cloudfront.net (AWS)

# DynamoDB
DynamoCache__Enabled=true
DynamoCache__ServiceUrl=http://localhost:8000 (local) or blank (AWS)
DynamoCache__Tables__LocalesCache__TableName=portfolio-dev-cache

# Cognito
Aws__Cognito__Authority=https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_cRS3mcP7U
Aws__Cognito__Audience=4ligvh2gi6e7713i72dgob118u

# GitHub Models API
GitHubModels__Enabled=false (local) or true (production)
GitHubModels__MockResponses=true (local) or false (production)
GitHubModels__ApiToken=<actual token in production>

# Authentication
Auth__JwtValidation=false (local) or true (production)

# Hashids
Hashids__Salt=local-dev-salt-change-in-prod (or from SSM in AWS)

# Application
ASPNETCORE_ENVIRONMENT=Development|Docker|Staging|Prod
ASPNETCORE_URLS=http://+:80
PATH_BASE=/portfolio-staging (for ALB path-based routing in AWS)
```

### Frontend Configuration

```
# API
VITE_API_URL=http://localhost:5000 (local) or https://api.healthdots.net (production)

# Auth
VITE_AUTH_DOMAIN=healthdots.auth.ca-central-1.amazoncognito.com
VITE_AUTH_CLIENT_ID=4ligvh2gi6e7713i72dgob118u
VITE_AUTH_REDIRECT_PATH=/callback
```

---

## Appendix B: Migration Path for Existing Developers

### For Existing Team Members

1. **Pull latest changes** (includes new appsettings and docker-compose)
2. **Run setup script:**
   ```powershell
   ./scripts/start-local-dev.ps1 -UseDocker
   ```
3. **No code changes needed** - continue working with existing workflow

### For New Team Members

1. **Clone repository**
2. **Run setup script:**
   ```powershell
   ./scripts/start-local-dev.ps1 -UseDocker
   ```
3. **Done!** - Full local stack running

---

## Appendix C: Known Issues & Workarounds

| Issue | Cause | Workaround |
|-------|-------|-----------|
| MinIO CORS errors | S3/MinIO CORS headers | Update MinIO policy or use signed URLs |
| DynamoDB table already exists | Schema conflicts | Delete volume: `docker volume rm portfolio_dynamodb_data` |
| API can't reach PostgreSQL | Docker network isolation | Ensure service names match in docker-compose |
| Frontend CORS errors | API CORS config | Add `Origin: http://localhost:5173` to API CORS policy |
| GitHubModels API timeout | Network issue or invalid token | Use mock service locally (`GitHubModels__Enabled=false`) |

---

## Appendix D: Advanced Configuration

### Multi-Environment Setup

Create environment-specific compose files:
- `docker-compose.dev.yml` - Developer laptop
- `docker-compose.ci.yml` - GitHub Actions runner
- `docker-compose.staging.yml` - Staging preview

Use: `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up`

### Health Checks & Observability

**Metrics Collection:**
```yaml
prometheus:
  image: prom/prometheus
  volumes:
    - ./docker/prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"
```

**Logging:**
```yaml
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
```

---

## Appendix E: Rollback Plan

If issues arise with local dev setup:

1. **Revert configuration changes:**
   ```bash
   git checkout APIs/Portfolio.Api/appsettings*.json
   git checkout docker-compose.yml
   ```

2. **Continue using AWS services:**
   - Deploy backend to ECS
   - Run frontend against cloud API
   - Full stack works as before

3. **No data loss:** All changes are configuration-only

---

## Summary

This plan enables three deployment modes with a single codebase:

| Mode | Deployment | AWS Services | Cost | Scenario |
|------|-----------|--------------|------|----------|
| **Laptop Dev** | Local + Docker services | Cognito only | $0 | Rapid iteration |
| **Docker Dev** | Docker Compose | Cognito only | $0 | Team onboarding |
| **Cloud Production** | Terraform to AWS | All services | $150-300/mo | Live deployment |

**Key Principle:** Configuration changes enable local dev without code changes or sacrificing cloud deployment capability.

---

**Next Steps:**
1. Review this plan with team
2. Start Phase 1 implementation
3. Create feature branch: `feat/local-dev-support`
4. Execute phases sequentially
5. Document learnings and update this plan
