Purpose
- Help an AI coding agent become productive in this repository quickly by summarizing architecture, developer workflows, environment pitfalls, and project-specific conventions.

Quick architecture overview
- Backend: `APIs/Portfolio.Api` — ASP.NET Core (net10.0) Web API using EF Core (Postgres). Key files:
  - `Program.cs` — app startup, CORS policy (`AppCors`), AWS client registration, auth, middleware.
  - `Controllers/PortfoliosController.cs` — main portfolio and asset endpoints (upload, edit, delete, list).
  - `Services/S3Service.cs` — S3 integration (upload, exists, delete) and CloudFront URL generation.
  - `Data/AppDbContext.cs` and `Migrations/` — EF models & migrations.

- Frontend: `portfolio-frontend` — React (Vite). Key files:
  - `src/pages/PortfolioEditor.jsx` — asset UI, upload flow, delete button wired to backend.
  - `src/services/portfolioApi.js` — HTTP client wrappers used across app (uploadAsset, deleteAsset, getPortfolioForEdit).

Important dev workflows & commands
- Backend:
  - Build: `dotnet build APIs/Portfolio.Api/Portfolio.Api.csproj`
  - Run (dev, foreground):
    ```powershell
    $env:ASPNETCORE_ENVIRONMENT='Development'
    & 'C:\Program Files\dotnet\dotnet.exe' run --project 'APIs/Portfolio.Api/Portfolio.Api.csproj'
    ```
  - Watch: VS Code tasks include `watch` (dotnet watch run) — see `.vscode/tasks.json`.

- Frontend:
  - Install / build: `npm install` then `npm run build` or `npm run dev` inside `portfolio-frontend`.

Environment & credentials (critical for local AWS integration)
- This project talks to AWS (S3, SSM, Cognito). Local development commonly uses AWS SSO profiles.
- Practical local approach: run `aws sso login --profile <name>` then export temporary creds into the same shell before starting the API:
  - export `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, and `AWS_REGION` (or set `AWS_PROFILE` + `AWS_SDK_LOAD_CONFIG=1`).
- The API logs credential resolution at startup (check console for `Aws:Region=..., Aws:Profile=..., CredentialsResolved=...`). If false, export temporary creds into the shell.
- Sensitive values (Hashids salt, etc.) may be stored in SSM under paths like `/portfolio/hashids/salt` — the app will fall back to `appsettings` if missing.

Project-specific patterns and gotchas
- S3 object keys: assets are stored under `img/{personId}/{filename}` — `PersonId` is the stable public identifier.
- Short IDs: `Portfolio.Id` is a short Hashids-derived value. `Hashids` salt is critical — rotating it changes generated IDs; use a salts-list strategy if rotation is required.
- CORS: `Program.cs` registers `AppCors` and expects `UseRouting()` before `UseCors()` and then `UseAuthentication()` / middleware / `UseAuthorization()`.
- Credentials resolution: the AWS SDK may attempt IMDS if credentials are unresolved; local dev must supply credentials to avoid runtime failures.
- AppLocker / Windows policy: running the API from some paths may be blocked; moving repo to `C:\dev\portfolio` or unblocking built DLL may be required.

Authentication & Authorization (Cognito + social login)
- The API uses AWS Cognito JWTs for authentication. Relevant startup config is in `Program.cs`:
  - `Aws:Cognito:Authority` → `options.Authority` for JWT validation.
  - `Aws:Cognito:Audience` → validated audiences (array).
  - The app sets a global FallbackPolicy that requires authenticated users by default; controllers use `[AllowAnonymous]` to opt-out (e.g., `HealthController`).
- JIT provisioning: `EnsureUserExistsMiddleware` inspects JWT claims (`sub`, `iss`, `email`, `cognito:username`/identities) and creates/updates a local `User` record if missing. It adds a `userId` claim to the ClaimsIdentity for downstream use.
- Use `ICurrentUserProvider` (`CurrentUserProvider`) to access the current user in controllers:
  - `GetUserId(HttpContext)` reads the `userId` claim (or `X-Debug-UserId` header in dev).
  - `GetCognitoSub(HttpContext)` returns the `sub` claim.
  - `GetEmail(HttpContext)` returns `email` claim.
- Social logins (Google) are supported via Cognito federation. The API just validates the Cognito JWT — federated Google users present a Cognito-backed `sub` and provider hints (e.g., `cognito:username` or identities claim). The middleware handles these transparently and records the provider in the `Users` table.


Where to change behavior
- Add new API endpoints: `APIs/Portfolio.Api/Controllers/PortfoliosController.cs`.
- S3 logic / content-type validation: `APIs/Portfolio.Api/Services/S3Service.cs` and `APIs/Portfolio.Api/Utils/FileSignatureValidator.cs`.
- Frontend asset UI: `portfolio-frontend/src/pages/PortfolioEditor.jsx` and styles in `PortfolioEditor.css`.
- HTTP client helpers: `portfolio-frontend/src/services/portfolioApi.js` — update here for consistent fetch patterns and error handling.

Logging & debugging
- Backend logs to console (Kestrel). Health endpoint: `GET /api/health` (anonymous).
- To reproduce credential issues: start API in the same shell used for AWS CLI SSO login and inspect startup diagnostic logs.

Testing & migrations
- Database migrations live in `APIs/Portfolio.Api/Migrations/` — use standard EF Core CLI to add or apply migrations. If you change models (e.g., add `FileSize`), create and run a migration.

Behavior expectations for AI edits
- Preserve existing public APIs and database schemas unless explicitly changing them; when changing models, add EF migrations and mention DB impact.
- Put environment-sensitive defaults in `appsettings.Development.json` or avoid hardcoding secrets.
- When modifying AWS interactions, prefer non-blocking behavior in dev (log warnings and fall back) but ensure production uses strict checks.

If anything looks incomplete or you'd like examples inserted (startup logs, sample env script), tell me which section to expand.
