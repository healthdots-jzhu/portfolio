# Portfolio Platform - Local Development Guide

This guide explains how to run the entire Portfolio platform locally without AWS dependencies.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Development Modes](#development-modes)
- [Environment Configuration](#environment-configuration)
- [Database Management](#database-management)
- [File Uploads & MinIO](#file-uploads--minio)
- [API Testing](#api-testing)
- [Authentication](#authentication)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Fastest Way: Full Docker Stack

```powershell
docker-compose up --build
```

Then open:
- Frontend: http://localhost:5173
- API: http://localhost:5000
- MinIO Console: http://localhost:9001 (admin/minioadmin123)
- DynamoDB Admin: http://localhost:8001

### Alternative: Hybrid (Local API + Docker Services)

```powershell
./scripts/start-local-dev.ps1 -Mode hybrid
```

This runs:
- API with `dotnet watch run` (for rapid iteration)
- Frontend with `npm run dev`
- PostgreSQL, MinIO, DynamoDB in Docker

### Laptop-Only (All Local)

Requires manual setup of PostgreSQL, MinIO, DynamoDB, etc.

```powershell
./scripts/start-local-dev.ps1 -Mode local
```

---

## Prerequisites

### Required

- **.NET 10.0 SDK** - [Download](https://dotnet.microsoft.com/download)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop) (for Docker modes)

### Recommended Tools

```powershell
# PostgreSQL client (for manual DB queries)
choco install postgresql

# AWS CLI (for some troubleshooting)
choco install awscli
```

---

## Development Modes

### Mode 1: Full Docker Stack (Recommended for First-Time Setup)

**Best for:** Team onboarding, consistent environments, minimal laptop setup

```powershell
docker-compose up --build
```

**What runs:**
- PostgreSQL (database)
- MinIO (S3 alternative)
- DynamoDB Local (cache)
- Portfolio API (.NET)
- Portfolio Frontend (React)

**Access:**
- Frontend: http://localhost:5173
- API: http://localhost:5000
- API Health: http://localhost:5000/api/v1/health

**Logs:**
```powershell
docker-compose logs -f api          # API only
docker-compose logs -f frontend     # Frontend only
docker-compose logs -f              # All services
```

**Stop:**
```powershell
docker-compose down
# Also remove data:
docker-compose down -v
```

### Mode 2: Hybrid Development (Recommended for Daily Work)

**Best for:** Rapid iteration, debugging, hot reload

```powershell
./scripts/start-local-dev.ps1 -Mode hybrid
```

**What runs:**
- PostgreSQL in Docker
- MinIO in Docker
- DynamoDB Local in Docker
- Portfolio API locally (`dotnet watch run`)
- Portfolio Frontend locally (`npm run dev`)

**Benefits:**
- Instant API/Frontend restart on file changes
- Easy breakpoint debugging
- Lighter system load than full Docker

**How to stop:**
- Press Ctrl+C in terminal

### Mode 3: Full Local (Advanced)

**Best for:** Minimal Docker usage, full laptop control

Requires manually running:
- PostgreSQL instance
- MinIO server
- DynamoDB Local
- .NET API
- npm frontend

---

## Environment Configuration

### Backend Configuration Files

```
APIs/Portfolio.Api/
├── appsettings.json              # Production defaults
├── appsettings.Development.json  # Local laptop settings
└── appsettings.Docker.json       # Docker container settings
```

**Key environment variables for local dev:**

```powershell
# Force local config
$env:ASPNETCORE_ENVIRONMENT = "Development"    # Uses appsettings.Development.json
$env:ASPNETCORE_ENVIRONMENT = "Docker"         # Uses appsettings.Docker.json

# Database
$env:ConnectionStrings__Postgres = "Host=localhost;Port=5432;Database=portfoliodb;Username=portfolio_user;Password=portfolio_password;SslMode=Disable"

# S3/MinIO
$env:Aws__S3__ServiceUrl = "http://localhost:9000"

# DynamoDB
$env:DynamoCache__ServiceUrl = "http://localhost:8000"

# Authentication (disable for local dev)
$env:Auth__JwtValidation = "false"

# GitHub Models API (mock for local)
$env:GitHubModels__Enabled = "false"
```

### Frontend Configuration Files

```
portfolio-frontend/
├── .env.development  # Local laptop
├── .env.docker       # Docker container
└── .env.production   # AWS deployment
```

**Vite loads .env.{mode} automatically based on NODE_ENV:**

```powershell
# Local development
npm run dev              # Uses .env.development

# Docker
NODE_ENV=docker npm run build
```

---

## Database Management

### Initialize Database

```powershell
./scripts/init-local-db.ps1
```

This:
1. Starts PostgreSQL container
2. Waits for it to be ready
3. Applies EF Core migrations

### Connect to Database

```bash
# From host
psql -h localhost -U portfolio_user -d portfoliodb

# From Docker container
docker exec -it portfolio-postgres psql -U portfolio_user -d portfoliodb
```

### Reset Database

**Option 1: Keep container, reset data**
```powershell
docker exec portfolio-postgres psql -U portfolio_user -d portfoliodb -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
./scripts/init-local-db.ps1
```

**Option 2: Full reset**
```powershell
docker-compose down -v postgres
docker-compose up -d postgres
./scripts/init-local-db.ps1
```

### View Migrations

```powershell
cd APIs/Portfolio.Api
dotnet ef migrations list
```

### Create New Migration

```powershell
cd APIs/Portfolio.Api
dotnet ef migrations add MigrationName
dotnet ef database update
```

---

## File Uploads & MinIO

### Access MinIO Console

- URL: http://localhost:9001
- Username: `admin`
- Password: `minioadmin123`

### Create Bucket (If Not Exists)

```bash
# Using MinIO client
mc alias set local http://localhost:9000 admin minioadmin123
mc mb local/portfolio-dev
mc anonymous set public local/portfolio-dev/img
```

### View Uploaded Files

In MinIO console:
1. Go to Buckets → `portfolio-dev`
2. Browse `img/` folder
3. Click file → Copy URL

---

## API Testing

### Health Check

```bash
curl http://localhost:5000/api/v1/health
```

### Without Authentication (Local)

```bash
curl http://localhost:5000/api/v1/portfolios

# With mock auth (any Bearer token works)
curl -H "Authorization: Bearer any-token" \
  http://localhost:5000/api/v1/portfolios
```

### With Postman

1. Create request to `http://localhost:5000/api/v1/portfolios`
2. Auth Tab → Type: **Bearer Token**
3. Token: `any-value` (ignored in local dev)
4. Send

### Swagger API Documentation

- **Local:** http://localhost:5000/swagger
- **Docker:** http://localhost:5000/swagger
- Automatically loads API definitions from controllers

---

## Authentication

### Local Development (Default)

**Auth is disabled by default** for rapid iteration:

```json
// appsettings.Development.json
{
  "Auth": {
    "JwtValidation": false
  }
}
```

Any request is treated as authenticated with test user:
- ID: `local-test-user-id-guid`
- Email: `test@local.dev`
- Claims: `sub`, `email`, `email_verified`

### Testing with Real Cognito

To test the real Cognito auth flow:

1. **Enable JWT validation:**
```json
{
  "Auth": {
    "JwtValidation": true
  }
}
```

2. **Configure Cognito OAuth redirect:**
   - Go to AWS Cognito console
   - Add `http://localhost:5173/callback` to App Client Redirect URIs

3. **Frontend will prompt Cognito login:**
   - Open http://localhost:5173
   - Click login
   - Enter Cognito credentials
   - Redirected back with valid JWT

4. **API will validate token against Cognito JWKS**

---

## Troubleshooting

### PostgreSQL Connection Refused

**Problem:** `psql: error: could not connect to server: Connection refused`

**Solution:**
```powershell
# Check if container is running
docker ps | Select-String postgres

# If not running:
docker-compose up -d postgres

# Wait a few seconds, then try again
Start-Sleep -Seconds 5
psql -h localhost -U portfolio_user -d portfoliodb
```

### MinIO Access Denied

**Problem:** Upload fails with 403 error in API

**Solution:**
```bash
# Recreate bucket with public access
docker exec portfolio-minio-init /bin/sh -c \
  "mc anonymous set public minio/portfolio-dev/img"
```

### DynamoDB Table Already Exists

**Problem:** `ResourceInUseException: Table already exists`

**Solution:**
```powershell
# Delete container and volume
docker-compose down -v dynamodb-local

# Restart
docker-compose up -d dynamodb-local
```

### Frontend Can't Reach API

**Problem:** `API call failed to http://localhost:5000`

**Solutions:**

1. **Check .env file:**
   ```powershell
   cat portfolio-frontend/.env.development
   # Should show: VITE_API_URL=http://localhost:5000
   ```

2. **Verify API is running:**
   ```bash
   curl http://localhost:5000/api/v1/health
   ```

3. **Check port conflict:**
   ```powershell
   netstat -ano | Select-String ":5000"
   # If taken, change port in docker-compose.yml or appsettings
   ```

4. **Clear Vite cache:**
   ```powershell
   cd portfolio-frontend
   rm -r node_modules/.vite
   npm run dev
   ```

### "ASPNETCORE_ENVIRONMENT not found"

**Problem:** API doesn't load correct appsettings file

**Solution:**
```powershell
# Explicitly set environment
$env:ASPNETCORE_ENVIRONMENT = "Development"
cd APIs/Portfolio.Api
dotnet watch run
```

### Docker Network Issues

**Problem:** Containers can't communicate (e.g., API can't reach PostgreSQL)

**Solution:**
```powershell
# Restart Docker
docker-compose restart

# Or rebuild network
docker-compose down
docker-compose up --build
```

### "Port already in use"

**Problem:** Docker can't bind port (e.g., 5000 already taken)

**Solutions:**

1. **Find process using port:**
   ```powershell
   netstat -ano | Select-String ":5000"
   taskkill /PID <PID> /F
   ```

2. **Or change port in docker-compose.yml:**
   ```yaml
   ports:
     - "5001:80"  # Use 5001 instead of 5000
   ```

### "Cannot connect to Docker daemon"

**Problem:** `docker: Cannot connect to the Docker daemon`

**Solution:**
```powershell
# Make sure Docker Desktop is running
# Or start Docker in WSL2 (if using Windows):
wsl --list -v
wsl -d Docker-Desktop
```

---

## Performance Tips

### Reduce Image Build Time

```powershell
# Build only what changed
docker-compose up --build api  # Rebuild API only

# Or use no-cache for fresh build
docker-compose build --no-cache
```

### Monitor Resource Usage

```powershell
# See what Docker is using
docker stats

# See process list
docker-compose ps
```

### Optimize Compilation

**Backend:**
```powershell
# Use incremental compilation
dotnet watch run
```

**Frontend:**
```powershell
# Hot Module Replacement speeds up dev
npm run dev  # Automatically includes HMR
```

---

## Deployment to AWS (Unchanged)

Local changes do NOT affect AWS deployment:

1. Commit changes to Git
2. Push to GitHub `main` branch
3. GitHub Actions triggers Terraform workflows
4. Production deployment uses real AWS services (RDS, S3, Cognito, etc.)

**See:** [Infrastructure Documentation](../../terraform/README.md)

---

## Common Workflows

### Start Working on Feature

```powershell
# Terminal 1: Hybrid mode (best for dev)
./scripts/start-local-dev.ps1 -Mode hybrid

# Terminal 2: Do Git work
git checkout -b feature/my-feature

# Make code changes
# Services auto-reload on save

# When done:
git add .
git commit -m "feat: description"
git push origin feature/my-feature
```

### Debug API

```powershell
cd APIs/Portfolio.Api

# With breakpoints in VSCode
dotnet watch run

# Or with Visual Studio
# F5 to Debug
```

### Test Frontend Changes Without Backend

```powershell
cd portfolio-frontend

# Mock API responses can go here
npm run dev
# Edit src/ files, save to see instant reload
```

### Run Tests

```powershell
# Backend tests (if exist)
cd APIs/Portfolio.Api
dotnet test

# Frontend tests (if exist)
cd portfolio-frontend
npm run test
```

---

## Next Steps

- **Read:** [Contribution Guidelines](../../CONTRIBUTING.md)
- **Learn:** [Architecture Documentation](../../architecture.drawio)
- **Deploy:** [Production Deployment Guide](../../terraform/README.md)
- **Config:** [Environment Variables Reference](./CONFIG_REFERENCE.md)

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review Docker logs: `docker-compose logs`
3. Check configuration files in `appsettings.*.json`
4. Open GitHub Issue with:
   - Error message
   - Steps to reproduce
   - Your environment (Docker version, OS, etc.)
