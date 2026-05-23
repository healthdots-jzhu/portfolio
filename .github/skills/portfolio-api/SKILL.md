---
name: portfolio-api
description: 'Work on the ASP.NET Core backend API in APIs/Portfolio.Api. Use when changing controllers, services, EF Core models or migrations, auth, S3, DynamoDB cache, Cognito JWT handling, API routes, PATH_BASE behavior, or backend configuration and validation.'
argument-hint: 'Describe the backend API change, endpoint, service, or data flow to work on.'
---

# Portfolio API

Use this skill for backend work in `APIs/Portfolio.Api`.

## When to Use

- Add or change API endpoints.
- Modify controllers, services, middleware, models, DTOs, or EF Core behavior.
- Change PostgreSQL persistence, migrations, or data contracts.
- Update Cognito auth, claim handling, CORS, S3 integration, SSM usage, or DynamoDB cache behavior.
- Investigate API issues that involve route shape, path base, environment configuration, or AWS service wiring.

## Repository Context

- Main project path: `APIs/Portfolio.Api`
- Entry point: `APIs/Portfolio.Api/Program.cs`
- Controllers: `APIs/Portfolio.Api/Controllers`
- Data layer: `APIs/Portfolio.Api/Data`
- Services: `APIs/Portfolio.Api/Services`
- Models and DTOs: `APIs/Portfolio.Api/Models`
- Migrations: `APIs/Portfolio.Api/Migrations`

## Working Rules

- Preserve the API contract unless the task explicitly requires a breaking change.
- If routing, DTOs, response shapes, or auth behavior change, check frontend impact before finishing.
- Keep `PATH_BASE` and ALB path routing aligned.
- Prefer existing services and patterns over introducing parallel abstractions.
- Treat Cognito, secrets, and database migrations as high-risk areas.

## Procedure

1. Start from the narrowest owning backend surface: controller action, service method, model, or migration.
2. Read only the nearby backend code needed to form a falsifiable hypothesis.
3. Make the smallest backend edit that addresses the root cause or requested behavior.
4. Validate with the narrowest relevant backend check.
5. If the backend contract changed, inspect the frontend call sites and deployment/config implications.

## Validation

Use the narrowest practical validation first:

```powershell
Set-Location APIs/Portfolio.Api
dotnet build
```

If publishing behavior matters:

```powershell
Set-Location APIs/Portfolio.Api
dotnet publish
```

If database changes are involved, also consider:

```powershell
Set-Location APIs/Portfolio.Api
dotnet ef database update
```

## Common Checks

- Does the route match the versioning and path-base expectations?
- Does the current user / auth flow still enforce ownership correctly?
- Are environment variable bindings still correct with `__` separators?
- If caching is involved, are invalidation paths still correct?
- If a migration is required, is it safe for non-empty environments?

## Related Docs

- `APIs/Portfolio.Api/README.md`
- `QUICK_START.md`
- `PORTFOLIO_MANAGEMENT_GUIDE.md`
