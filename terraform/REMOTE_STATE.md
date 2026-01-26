# Remote Terraform state (S3 + DynamoDB) — setup & migration

This file describes how to create the S3 bucket and DynamoDB table to store and lock Terraform state, and how to migrate the existing local state to the S3 backend.

Prerequisites
- AWS CLI configured and authenticated (e.g. `aws sso login --profile <profile>`).
- IAM user or role used must have permissions to create buckets, manage bucket encryption/versioning, and create DynamoDB tables.

1) Create the S3 bucket (example uses `ca-central-1`)

Replace `<BUCKET_NAME>` and run:

```bash
aws s3api create-bucket \
  --bucket <BUCKET_NAME> \
  --region ca-central-1 \
  --create-bucket-configuration LocationConstraint=ca-central-1

# Enable versioning
aws s3api put-bucket-versioning --bucket <BUCKET_NAME> --versioning-configuration Status=Enabled

# Enable default SSE (AES256)
aws s3api put-bucket-encryption --bucket <BUCKET_NAME> \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

2) Create the DynamoDB table for state locking

Replace `<LOCK_TABLE>` and run:

```bash
aws dynamodb create-table \
  --table-name <LOCK_TABLE> \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region ca-central-1
```

3) Initialize Terraform with the S3 backend and migrate local state

From the `terraform/` directory run (replace placeholders):

```bash
terraform init -reconfigure \
  -backend-config="bucket=<BUCKET_NAME>" \
  -backend-config="key=portfolio/terraform.tfstate" \
  -backend-config="region=ca-central-1" \
  -backend-config="dynamodb_table=<LOCK_TABLE>" \
  -backend-config="encrypt=true"

# Terraform will prompt to copy local state into the new backend. Confirm when prompted.

# Verify by running
terraform plan
```

Notes
- If you prefer non-interactive operation, use `-input=false` and run in a shell where AWS credentials are present.
- Alternatively you can create the bucket and lock table via a small separate Terraform configuration and `apply` that first, then initialize the main configuration against the S3 backend.
