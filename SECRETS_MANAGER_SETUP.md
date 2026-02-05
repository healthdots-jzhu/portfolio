# Secrets Manager Configuration

This project uses AWS Secrets Manager to securely manage sensitive configuration values at runtime.

## Secrets

The following secrets must be configured in Secrets Manager for each environment (staging, beta, prod):

### 1. Postgres Connection String
- **Secret Name**: `{environment}-{project_name}-postgres-connection-{suffix}`
- **Key**: `connection_string`
- **Value**: PostgreSQL connection string (e.g., `Host=...;Database=...;Username=...;Password=...`)
- **Environment Variable**: `ConnectionStrings__Postgres`

### 2. GitHub Models API Token
- **Secret Name**: `{environment}-{project_name}-github-models-token-{suffix}`
- **Key**: `api_token`
- **Value**: GitHub Models API token (e.g., `github_pat_...`)
- **Environment Variable**: `GitHubModels__ApiToken`

## Setup Instructions

### Initial Setup with Terraform

1. Apply the Terraform configuration to create the secrets with placeholder values:
   ```bash
   cd terraform
   terraform apply
   ```

2. Update the secret values manually using AWS CLI or Console:
   ```bash
   # Update Postgres connection string
   aws secretsmanager put-secret-value \
     --secret-id <secret-arn> \
     --secret-string '{"connection_string":"Host=...;Database=...;Username=...;Password=..."}'
   
   # Update GitHub Models API token
   aws secretsmanager put-secret-value \
     --secret-id <secret-arn> \
     --secret-string '{"api_token":"github_pat_..."}'
   ```

3. The ECS task definition automatically references these secrets and injects them as environment variables at runtime.

## ECS Task Configuration

The ECS task definition in `terraform/ecs.tf` configures:
- **Execution Role**: Has `secretsmanager:GetSecretValue` permission to pull secrets at task startup
- **Task Role**: Has application runtime permissions (S3, SSM)
- **Secrets Injection**: Secrets are mounted as environment variables using the `secrets` field in container definitions

## Application Configuration

The ASP.NET Core application in `Program.cs`:
- Reads `ConnectionStrings__Postgres` from environment variables (highest priority) or falls back to `appsettings.json`
- Reads `GitHubModels__ApiToken` from environment variables (highest priority) or falls back to `appsettings.json`
- Uses .NET configuration binding with `__` delimiter for nested keys

## Security Best Practices

- Secrets are encrypted at rest using KMS
- ECS tasks retrieve secrets at startup; they never appear in task definition JSON
- IAM policies restrict which tasks can access which secrets
- Secrets rotation can be performed without redeploying code (restart ECS tasks to pick up new values)
- Never commit actual secret values to git; `appsettings.json` contains only placeholders

## Infrastructure Changes for URL Pattern

### Recommended Approach: ALB Path-Based Routing

The Terraform configuration in `ecs.tf` sets up:
- Application Load Balancer with HTTP→HTTPS redirect
- Path-based routing: `/portfolio-{environment}/*` routes to the ECS service
- HTTPS listener with ACM certificate
- Health checks on `/api/health`

### DNS Configuration

Create a Route53 A record for `api.healthdots.net`:
- Type: A
- Alias: Yes
- Target: Application Load Balancer DNS name
- Zone ID: ALB zone ID (from Terraform output)

### API Base URL

Frontend should use: `https://api.healthdots.net/portfolio-{environment}/content`

The ALB will route requests to the appropriate ECS service based on the path prefix.

## Deployment Workflow

1. Build and push Docker image (GitHub Actions workflow)
2. Update ECS service to use new image
3. ECS pulls secrets from Secrets Manager at task startup
4. Tasks start with injected environment variables
5. Application reads secrets from environment variables

## Troubleshooting

### Task fails to start with "AccessDeniedException"
- Check that the execution role has `secretsmanager:GetSecretValue` permission
- Verify the secret ARN in the task definition matches the actual secret

### Application logs "Connection string is not configured"
- Verify the secret exists and has the correct key (`connection_string`)
- Check CloudWatch logs for the ECS task to see environment variable values
- Ensure the ECS task definition `secrets` field uses the correct JSON path syntax: `{secret-arn}:connection_string::`

### API returns 503 or health check fails
- Check ECS task logs in CloudWatch
- Verify the security group allows ALB→ECS on port 80
- Verify the target group health check path is correct (`/api/health`)
