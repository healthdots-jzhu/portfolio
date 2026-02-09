Secrets Manager: runtime provisioning

This short guide explains the preferred flow for populating Secrets Manager values for each environment.

Overview
- Terraform creates secret *resources* (names, KMS key, tags) but does not keep secret values in state.
- Provide secret values at runtime either via the GitHub Actions manual dispatch inputs (preferred) or via the AWS CLI/console.

Secret names (created by Terraform)
- Postgres connection secret: `healthdots-{environment}-postgres-connection`
  - Key: `connection_string`
  - Injected env var: `ConnectionStrings__Postgres`

- GitHub Models token secret: `healthdots-{environment}-github-models-token`
  - Key: `api_token`
  - Injected env var: `GitHubModels__ApiToken`

Manual (recommended) — GitHub Actions workflow dispatch
1. In GitHub: Actions → "Deploy Infrastructure (backend stack - vpc, ec2, rds, etc.)" → Run workflow.
2. Choose `environment` (e.g., `beta`) and fill these inputs:
   - `postgres_connection_string` — the full DB connection string
   - `github_models_api_token` — the GitHub Models API token
3. The workflow will verify the secret resource exists and call `aws secretsmanager put-secret-value` to update the secret values for that environment.

CLI alternative
```bash
aws secretsmanager put-secret-value --secret-id "healthdots-beta-postgres-connection" --secret-string '{"connection_string":"Host=...;Database=...;Username=...;Password=..."}'

aws secretsmanager put-secret-value --secret-id "healthdots-beta-github-models-token" --secret-string '{"api_token":"github_pat_..."}'
```

Verification
```bash
aws secretsmanager describe-secret --secret-id "healthdots-beta-postgres-connection"
```

Security note
- Do NOT store plaintext secret values in Terraform variables or commit them to source control; Terraform state is not a secure secret store.
- Use the manual workflow dispatch or CI pipelines that write secret values directly to Secrets Manager.

If you want, I can retry updating the original `SECRETS_MANAGER_SETUP.md` file in-place (I ran into a patching hiccup), or I can replace the original file with this content — which do you prefer?