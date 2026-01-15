# AWS Resource Scheduler

This directory contains the automated cost-saving scheduler that stops and starts AWS resources (EC2 and RDS) on a daily schedule.

## Overview

The scheduler automatically:
- **Stops** EC2 instance and RDS database at **12:00 AM ET** (5:00 AM UTC during DST)
- **Starts** EC2 instance and RDS database at **9:00 AM ET** (2:00 PM UTC during DST)

This saves approximately **15 hours of runtime daily** (60-65% cost reduction on compute resources).

## Architecture

The solution uses AWS-native services:
- **Lambda Function**: Python-based function to start/stop resources
- **EventBridge Rules**: Two cron schedules (one for stop, one for start)
- **CloudWatch Logs**: Logs all scheduler activities
- **IAM Role**: Grants Lambda permissions to manage EC2 and RDS

## Components

### Files
- `scheduler.tf` - Terraform configuration for all scheduler resources
- `lambda/scheduler.py` - Python Lambda function code
- `lambda/scheduler.zip` - Packaged Lambda deployment (auto-generated)

### Resources Created
1. Lambda function: `{project}-{env}-resource-scheduler`
2. IAM role and policies for Lambda execution
3. CloudWatch Log Group with 7-day retention
4. Two EventBridge rules with cron schedules
5. Lambda permissions for EventBridge invocation

## Deployment

### Initial Setup

```bash
cd terraform

# Initialize Terraform (if not already done)
terraform init

# Review changes
terraform plan

# Apply the scheduler configuration
terraform apply
```

### Verify Deployment

```bash
# Check Lambda function
aws lambda get-function --function-name healthdots-dev-resource-scheduler --region ca-central-1

# Check EventBridge rules
aws events list-rules --name-prefix healthdots-dev --region ca-central-1

# View scheduler outputs
terraform output scheduler_lambda_function_name
terraform output scheduler_stop_time
terraform output scheduler_start_time
```

## Testing

### Manual Testing

You can manually trigger the Lambda function to test start/stop operations:

**PowerShell:**
```powershell
# Create payload file
@'
{"action":"stop"}
'@ | Out-File -FilePath payload.json -Encoding ASCII -NoNewline

# Test STOP action
$env:AWS_PROFILE="Admin-199061575177"
aws lambda invoke `
  --function-name healthdots-beta-resource-scheduler `
  --region ca-central-1 `
  --cli-binary-format raw-in-base64-out `
  --payload file://payload.json `
  response.json

# View results
Get-Content response.json | ConvertFrom-Json | ConvertTo-Json -Depth 5

# Test START action
@'
{"action":"start"}
'@ | Out-File -FilePath payload.json -Encoding ASCII -NoNewline

aws lambda invoke `
  --function-name healthdots-beta-resource-scheduler `
  --region ca-central-1 `
  --cli-binary-format raw-in-base64-out `
  --payload file://payload.json `
  response.json

# View results
Get-Content response.json | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**Bash/Linux:**
```bash
# Test STOP action
aws lambda invoke \
  --function-name healthdots-beta-resource-scheduler \
  --region ca-central-1 \
  --payload '{"action":"stop"}' \
  response.json

# Test START action
aws lambda invoke \
  --function-name healthdots-beta-resource-scheduler \
  --region ca-central-1 \
  --payload '{"action":"start"}' \
  response.json

# View results
cat response.json
```

### Expected Output

**STOP Action** (successful):
```json
{
  "action": "stop",
  "ec2": {
    "instance_id": "i-033cb58cea4ce4dfc",
    "previous_state": "running",
    "action": "stopped",
    "status": "success"
  },
  "rds": {
    "instance_id": "healthdots-postgres-...",
    "previous_state": "available",
    "action": "stopped",
    "status": "success"
  }
}
```

**START Action** (successful):
```json
{
  "action": "start",
  "ec2": {
    "instance_id": "i-033cb58cea4ce4dfc",
    "previous_state": "stopped",
    "action": "started",
    "status": "success"
  },
  "rds": {
    "instance_id": "healthdots-postgres-...",
    "previous_state": "stopped",
    "action": "started",
    "status": "success"
  }
}
```


### Check CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/healthdots-dev-resource-scheduler --follow --region ca-central-1

# Or use the CloudWatch console URL from terraform output
terraform output scheduler_cloudwatch_logs
```

## Monitoring

### Check Scheduler Status

```bash
# Check EC2 state
aws ec2 describe-instances \
  --instance-ids $(terraform output -raw ec2_instance_id) \
  --query 'Reservations[0].Instances[0].State.Name' \
  --region ca-central-1

# Check RDS state
aws rds describe-db-instances \
  --db-instance-identifier $(terraform output -raw rds_endpoint | cut -d: -f1) \
  --query 'DBInstances[0].DBInstanceStatus' \
  --region ca-central-1
```

### CloudWatch Metrics

The Lambda function logs all operations. Check CloudWatch Logs for:
- Successful start/stop operations
- Errors or failures
- State transitions

## Timezone Considerations

⚠️ **Important**: The cron schedules use UTC time. Eastern Time (ET) observes Daylight Saving Time:
- **EDT (Eastern Daylight Time)**: UTC-4 (March to November)
- **EST (Eastern Standard Time)**: UTC-5 (November to March)

Current configuration assumes EDT. If you need EST, adjust the cron expressions:
- Stop: Change from `cron(0 5 * * ? *)` to `cron(0 6 * * ? *)`
- Start: Change from `cron(0 14 * * ? *)` to `cron(0 15 * * ? *)`

To handle DST automatically, you could:
1. Use AWS Systems Manager maintenance windows (supports timezone)
2. Update the Lambda function to check timezone dynamically
3. Manually update cron schedules twice yearly

## Cost Savings

Assuming t4g.micro EC2 (~$0.0084/hr) and db.t4g.micro RDS (~$0.016/hr):

**Daily Savings**:
- EC2: 15 hours × $0.0084 = $0.126/day
- RDS: 15 hours × $0.016 = $0.24/day
- **Total: ~$0.37/day**

**Monthly Savings**: ~$11/month (~65% reduction)

## Troubleshooting

### Resources Not Stopping/Starting

1. Check Lambda logs:
   ```bash
   aws logs tail /aws/lambda/healthdots-dev-resource-scheduler --follow
   ```

2. Verify IAM permissions:
   ```bash
   aws iam get-role-policy --role-name $(terraform output -raw scheduler_lambda_function_name | sed 's/-resource-scheduler/-lambda-scheduler-/')* --policy-name *
   ```

3. Test manually:
   ```bash
   aws lambda invoke --function-name healthdots-dev-resource-scheduler \
     --payload '{"action":"stop"}' response.json
   ```

### EventBridge Not Triggering

1. Check rules are enabled:
   ```bash
   aws events describe-rule --name healthdots-dev-stop-resources
   aws events describe-rule --name healthdots-dev-start-resources
   ```

2. Verify Lambda permissions:
   ```bash
   aws lambda get-policy --function-name healthdots-dev-resource-scheduler
   ```

### RDS Won't Stop

RDS instances cannot be stopped if:
- They are in a DB cluster
- They have read replicas
- They were recently started (must run for 7 days minimum if part of backup)
- They are in a maintenance window

Check RDS status:
```bash
aws rds describe-db-instances --db-instance-identifier <your-rds-id>
```

## Customization

### Change Schedule Times

Edit `scheduler.tf` and modify the cron expressions:

```hcl
# Example: Stop at 11 PM ET (4 AM UTC during DST)
schedule_expression = "cron(0 4 * * ? *)"

# Example: Start at 8 AM ET (1 PM UTC during DST)
schedule_expression = "cron(0 13 * * ? *)"
```

Then apply changes:
```bash
terraform apply
```

### Add More Resources

Edit `lambda/scheduler.py` and add handling for additional AWS resources (ECS, ElastiCache, etc.).

### Disable Scheduler

To temporarily disable without destroying:

```bash
# Disable EventBridge rules
aws events disable-rule --name healthdots-dev-stop-resources --region ca-central-1
aws events disable-rule --name healthdots-dev-start-resources --region ca-central-1
```

To permanently remove:
```bash
# Comment out scheduler.tf in your Terraform and apply
terraform apply
```

## Manual Override

If you need to start resources outside the schedule:

```bash
# Start EC2
aws ec2 start-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Start RDS
aws rds start-db-instance --db-instance-identifier <your-rds-id>
```

The scheduler will respect the next scheduled action regardless of manual interventions.

## Support

For issues or questions:
1. Check CloudWatch Logs for error messages
2. Verify resource states in AWS Console
3. Review Terraform plan/apply output for deployment issues
