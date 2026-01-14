# AWS Portfolio RDS + EC2 via SSM - Terraform Configuration

## Overview
This Terraform configuration creates a secure, minimal setup for accessing a PostgreSQL RDS database through an EC2 instance via AWS Systems Manager (SSM) Session Manager.

### Architecture
- **EC2 Instance** (t4g.micro, Graviton2 ARM): Serves as bastion host with SSM access
- **RDS PostgreSQL**: Private database in separate subnet
- **VPC**: Custom VPC with public and private subnets
- **Security Groups**: Restrict database access to EC2 only
- **IAM Role**: EC2 has SSM permissions for secure shell access
- **KMS Encryption**: RDS data encrypted at rest

## Features
✅ **SSM Session Manager**: No SSH keys needed, encrypted sessions via AWS Systems Manager
✅ **t4g.micro**: Cost-effective, free tier eligible
✅ **Private RDS**: Database only accessible from EC2 instance
✅ **Encryption**: RDS encrypted with customer-managed KMS key
✅ **Monitoring**: CloudWatch monitoring enabled
✅ **Backup**: Automated daily backups retained for 7 days

## Prerequisites
- AWS Account with appropriate permissions
- AWS CLI v2 configured with credentials
- Terraform >= 1.0
- The Session Manager Plugin (optional; AWS CLI can proxy sessions)

## Quick Start

### 1. Initialize Terraform
```bash
cd terraform
terraform init
```

### 2. Configure Variables
Copy the example and update with your values:
```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
- **aws_region**: Your preferred AWS region
- **rds_password**: Set via `TF_VAR_rds_password` env var (min 8 chars, uppercase, lowercase, numbers, special chars)
- Other variables (optional, defaults are provided)

Set the RDS password via environment variable (do **not** add it to terraform.tfvars):

- PowerShell:
```powershell
$env:TF_VAR_rds_password = "<StrongPassword>"
```
- bash:
```bash
export TF_VAR_rds_password="<StrongPassword>"
```

### 3. Plan and Apply
```bash
terraform plan
terraform apply
```

Terraform will output:
- EC2 instance ID and IPs
- RDS endpoint and port
- SSM session command
- PostgreSQL connection string

### 4. Verify Deployment
```bash
# Get instance ID from Terraform output
terraform output ec2_instance_id

# Start SSM session
aws ssm start-session --target <instance-id> --region us-east-1
```

## Connecting to PostgreSQL

### Option A: Via SSM Session (Recommended)
```bash
# 1. Start SSM session
aws ssm start-session --target $(terraform output -raw ec2_instance_id) --region us-east-1

# 2. Inside the session, connect to PostgreSQL
psql -h <rds-address> -U postgres -d portfoliodb

# Or use the helper script
connect-postgres portfoliodb postgres
```

### Option B: Using AWS Session Manager Port Forwarding
```bash
aws ssm start-session \
  --target <instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{
    "host":["<rds-address>"],
    "portNumber":["5432"],
    "localPortNumber":["5432"]
  }' \
  --region us-east-1

# In another terminal:
psql -h localhost -U postgres -d portfoliodb
```

## Security Best Practices

1. **RDS Password**: 
   - Use a strong, randomly generated password
   - Store in AWS Secrets Manager (not in terraform.tfvars)
   - Never commit terraform.tfvars to version control

2. **Database Access**:
   - Security groups restrict access to EC2 only
   - Database is in private subnet, not accessible from internet
   - All traffic encrypted in transit and at rest

3. **Session Manager**:
   - No inbound ports exposed
   - All sessions logged to CloudTrail
   - IAM-based access control

4. **Backups**:
   - Automated daily backups retained 7 days
   - Cross-region replication available (set rds_multi_az = true)

## Terraform Files

- **main.tf**: VPC, EC2, RDS, IAM resources
- **variables.tf**: Input variable definitions
- **outputs.tf**: Output values (instance ID, RDS endpoint, etc.)
- **user_data.sh**: EC2 startup script (installs PostgreSQL client, AWS CLI)
- **terraform.tfvars.example**: Example variable values

## Cost Estimation (US East 1, on-demand)
- EC2 t4g.micro: ~$3.50/month (free tier eligible)
- RDS db.t4g.micro: ~$8.50/month
- Storage (20GB): ~$2.00/month
- **Total: ~$14/month** (free tier: $0-3)

## Cleanup
```bash
terraform destroy
```

## Troubleshooting

### "Organization policies are preventing installation"
SSM Session Manager can work without the plugin installed locally. AWS CLI will proxy the connection.

### "Session is not in a connected state"
1. Verify EC2 instance has IAM role with `AmazonSSMManagedInstanceCore` policy
2. Check EC2 instance can reach SSM endpoint (VPC needs IGW or NAT gateway)
3. Verify security group allows outbound HTTPS (port 443)

### Can't connect to PostgreSQL
1. Verify RDS endpoint and port from Terraform outputs
2. Check RDS security group allows port 5432 from EC2 security group
3. Verify PostgreSQL is ready (check RDS status in AWS console)
4. Test connectivity from EC2: `telnet <rds-address> 5432`

### Permission Denied when running Terraform
Ensure AWS CLI credentials have permissions for:
- EC2, RDS, VPC, IAM, KMS, Security Groups
- Or use IAM role with `PowerUserAccess` + manual RDS/KMS/IAM setup

## Next Steps

1. **Connect to database and create tables**
2. **Update RDS password in AWS Secrets Manager**
3. **Configure application to connect to RDS** (use endpoint from outputs)
4. **Enable Multi-AZ** for production (set `rds_multi_az = true`)
5. **Increase backup retention** for production (set `rds_backup_retention_period = 30`)
6. **Use Terraform remote state** (uncomment backend in main.tf)

## Resources
- [AWS SSM Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
- [PostgreSQL Client](https://www.postgresql.org/download/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
