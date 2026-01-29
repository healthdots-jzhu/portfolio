# EF Core Migrations Guide

## Prerequisites
- .NET SDK installed
- PostgreSQL database accessible
- Connection string configured in appsettings.json

## Generate Migration

To create a new migration after model changes:

```powershell
cd C:\Users\zhuya\Code\portfolio\APIs\Portfolio.Api
dotnet ef migrations add InitialCreate
```

## Generate SQL Script

To generate SQL script for deployment automation:

```powershell
# Generate script for all migrations
dotnet ef migrations script -o Migrations/Scripts/InitialCreate.sql

# Generate script from a specific migration
dotnet ef migrations script PreviousMigration InitialCreate -o Migrations/Scripts/InitialCreate.sql

# Generate idempotent script (can be run multiple times safely)
dotnet ef migrations script --idempotent -o Migrations/Scripts/InitialCreate_Idempotent.sql
```

## Apply Migrations

### Locally (Development)
```powershell
dotnet ef database update
```

### Production (Via CI/CD)
Apply the generated SQL script through your deployment pipeline:
```powershell
psql -h \ -U \ -d portfolio -f Migrations/Scripts/InitialCreate.sql
```

## Notes
- Always generate idempotent scripts for production deployments
- Review generated SQL before applying to production
- Keep migration scripts in version control under Migrations/Scripts/
