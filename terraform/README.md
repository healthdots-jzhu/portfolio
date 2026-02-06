# AWS Portfolio Infrastructure - Terraform

## Overview
This Terraform configuration provisions the AWS infrastructure for the portfolio system, including:

- VPC with public and private subnets
- Application Load Balancer (ALB)
- ECS Fargate service for the Portfolio API
- RDS PostgreSQL database (encrypted with KMS)
- VPC endpoints for private AWS service access (Secrets Manager, ECR, STS, S3, SSM)
- Secrets Manager integration for app secrets
- ECR repository for API images
- Scheduler (Lambda + EventBridge) to stop/start EC2 and RDS

Note: Frontend hosting (S3 + CloudFront) is documented in `portfolio-frontend/deployment-guide.md` and is not fully managed in this Terraform stack.

## Prerequisites
- AWS account with appropriate permissions
- AWS CLI v2 configured
- Terraform >= 1.0

## Quick Start

### 1. Initialize Terraform
```powershell
Set-Location terraform
terraform init
```

### 2. Configure Variables
Copy the example and update with your values:
```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
```

Key variables:
- `aws_region`
- `environment`
- `project_name`
- `rds_database_name`
- `rds_username`
- `ecs_service_desired_count`

### 3. Plan and Apply
```powershell
terraform plan
terraform apply
```

## RDS Credentials
`aws_db_instance.postgres-portfolio` uses `manage_master_user_password = true`. AWS stores the master password in Secrets Manager. Retrieve it in the AWS console or via CLI as needed.

## Connecting to PostgreSQL (via SSM)
```powershell
# Start SSM session
aws ssm start-session --target (terraform output -raw ec2_instance_id) --region ca-central-1

# Inside the session
psql -h <rds-address> -U <rds-username> -d <db-name>
```

## Notes
- ALB HTTPS listener requires an ACM certificate (`var.acm_certificate_arn`).
- ECS tasks run in private app subnets and reach AWS services via VPC endpoints.
- Scheduler (EventBridge + Lambda) stops/starts EC2 and RDS on schedule (see `SCHEDULER_README.md`).

## Files
- `main.tf`: VPC, subnets, RDS, EC2, IAM, KMS, VPC endpoints, scheduler
- `ecs.tf`: ECS cluster, service, ALB, target group, task definition, secrets
- `variables.tf`: core variables
- `ecs_variables.tf`: ECS/ALB-related variables
- `outputs.tf`: useful outputs

## Remote State
See `REMOTE_STATE.md` for S3 + DynamoDB state backend setup.

## Cleanup
```powershell
terraform destroy
```
