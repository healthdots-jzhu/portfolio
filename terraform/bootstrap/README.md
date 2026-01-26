# Bootstrap Terraform: create S3 backend bucket and DynamoDB lock table

This module provisions an S3 bucket (versioned, encrypted, private) and a DynamoDB table used for Terraform state locking.

Steps

1. Change to the bootstrap directory:

```bash
cd terraform/bootstrap
```

2. Initialize and apply the bootstrap config (replace placeholders):

```bash
terraform init
# Option A: pass variables on the CLI
terraform apply -var="bucket_name=<BUCKET_NAME>" -var="lock_table_name=<LOCK_TABLE>" -auto-approve

# Option B (recommended): create a `terraform.tfvars` or use the provided example
# Copy the example and edit values:
# cp terraform.tfvars.example terraform.tfvars
# terraform apply -var-file=terraform.tfvars -auto-approve
```

3. Verify outputs (example):

```bash
terraform output -raw bucket_name
terraform output -raw lock_table_name
```

4. Reconfigure the main `terraform/` backend to use the newly-created bucket and lock table:

From the repository root run (replace placeholders with outputs from step 3):

```bash
cd terraform
terraform init -reconfigure \
  -backend-config="bucket=<BUCKET_NAME>" \
  -backend-config="key=portfolio/terraform.tfstate" \
  -backend-config="region=ca-central-1" \
  -backend-config="dynamodb_table=<LOCK_TABLE>" \
  -backend-config="encrypt=true"

# Terraform will prompt to copy local state into the new backend. Confirm when prompted.
terraform plan
```

Notes
- Backend config values are provided on the `terraform init` command because backend blocks cannot use variables.
- Make sure the AWS principal you run these commands with has permissions to create buckets and DynamoDB tables.
- If you prefer to create the bucket/table using the AWS CLI, see `REMOTE_STATE.md` in the `terraform/` folder.
- To avoid passing values every time, edit `terraform.tfvars` in this folder (or set `TF_VAR_` environment variables) and use `-var-file` when running.
