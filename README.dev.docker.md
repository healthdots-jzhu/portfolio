# Development: running the API in Docker

This project supports running the `APIs/Portfolio.Api` inside a container for local development.

Quick steps

1. Copy `.env.example` to `.env` and fill in values (RDS connection string or DB you want to use, AWS profile or credentials).

2. Start the API container (compose only runs the API; DB is expected to be external such as RDS):

```bash
docker compose up --build
```

3. The API will be available at: http://localhost:5000

Important environment variables

- `ConnectionStrings__Postgres` — Full Npgsql connection string (recommended). The app looks for this env var first.
- `AWS_PROFILE` or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — AWS credentials for S3 and SSM access.
- `AWS_REGION` — AWS region for AWS SDK clients.
- `AWS_S3_BUCKET` — S3 bucket name used by `S3Service`.
- `HASHIDS_PARAMETER` — Optional SSM parameter path for Hashids salt.
- `ASPNETCORE_ENVIRONMENT` — `Development` or `Production`.

How environment variables map into the app and how to make them available at runtime

- .NET configuration mapping: the app reads keys like `Aws:S3:BucketName` and `Hashids:ParameterName` from IConfiguration.
	Environment variables map to these JSON keys by replacing `:` with `__` (double underscore). Example:
	- `Aws:S3:BucketName` -> set `Aws__S3__BucketName` in the environment
	- `Hashids:ParameterName` -> set `Hashids__ParameterName` in the environment

- Docker Compose `.env` behavior vs container environment:
	- Compose loads `.env` for variable substitution (so `${AWS_PROFILE}` in `docker-compose.yml` will be replaced).
	- Compose does NOT automatically inject every `.env` key into the container process — you must either:
		- Add an `env_file: - .env` entry under the service to inject all key=value pairs into the container, or
		- Explicitly map each variable in `docker-compose.yml` under `environment:` (this repository uses explicit mappings for clarity).

- Example explicit mappings (what the compose file now provides):
	- `ConnectionStrings__Postgres: ${ConnectionStrings__Postgres}` -> populates `ConnectionStrings:Postgres`
	- `Aws__Region: ${AWS_REGION}` -> populates `Aws:Region`
	- `Aws__S3__BucketName: ${AWS_S3_BUCKET}` -> populates `Aws:S3:BucketName`
	- `Hashids__ParameterName: ${HASHIDS_PARAMETER}` -> populates `Hashids:ParameterName`
	- `Aws__Profile: ${AWS_PROFILE}` and/or AWS SDK env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) are accepted by the SDK for credentials.

- Notes about `AWS_PROFILE` and SSO tokens:
	- If you set `AWS_PROFILE` inside the container, the AWS SDK will look for that profile in `~/.aws/config` and `~/.aws/credentials` inside the container filesystem. To use the host's profile, mount your `~/.aws` into the container (e.g., `- ./aws:/root/.aws`) or prefer environment credentials.
	- SSO-based session tokens on the host typically don't work automatically inside containers unless you also mount the relevant SSO files; using `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` or an IAM role is more reliable for containers.

- SSM parameter usage for Hashids salt:
	- If `Hashids:ParameterName` is set, the app attempts to call SSM `GetParameter` during startup to fetch the salt. The container's credentials must permit `ssm:GetParameter` (and `kms:Decrypt` if using SecureString).
	- To avoid needing SSM in containers, set `Hashids__Salt` directly in the environment.

Runtime checklist

- Make sure `ConnectionStrings__Postgres` points to your RDS (or other DB) when running the container.
- Ensure the container has AWS credentials (via `AWS_*` env vars, `AWS_PROFILE` + mounted `~/.aws`, or an IAM role in your orchestrator).
- If you rely on SSM, give the container credentials permission to read the parameter.


Security notes

- Do not commit `.env` or any files with secrets. Use `.env.example` as the template.
- For production, use IAM roles (ECS task role, EKS service account) and managed secrets (SSM, Secrets Manager).

Database migrations

Apply EF Core migrations from your development machine or CI pipeline against the target database. The container image does not automatically run migrations.
