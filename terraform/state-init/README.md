# State Init: create S3 backend bucket and DynamoDB lock table

This module provisions an S3 bucket (versioned, encrypted, private) and a DynamoDB table used for Terraform state locking.

Steps

1. Change to the module directory:

```powershell
Set-Location terraform/state-init
```

2. Initialize and apply the module (replace placeholders):

```powershell
terraform init
terraform apply -var="bucket_name=<BUCKET_NAME>" -var="lock_table_name=<LOCK_TABLE>" -auto-approve
```

3. Verify outputs (example):

```powershell
terraform output -raw bucket_name
terraform output -raw lock_table_name
```

4. Reconfigure the main `terraform/` backend to use the newly-created bucket and lock table (from repo root):

```powershell
Set-Location terraform
terraform init -reconfigure `
  -backend-config="bucket=<BUCKET_NAME>" `
  -backend-config="key=portfolio/terraform.tfstate" `
  -backend-config="region=ca-central-1" `
  -backend-config="dynamodb_table=<LOCK_TABLE>" `
  -backend-config="encrypt=true"

# Terraform will prompt to copy local state into the new backend. Confirm when prompted.
terraform plan
```

Notes
- Backend config values are provided on the `terraform init` command because backend blocks cannot use variables.
- Ensure the AWS principal you run these commands with has permissions to create buckets and DynamoDB tables.
- To avoid passing values every time, edit `terraform.tfvars` in this folder (or set `TF_VAR_` environment variables) and use `-var-file` when running.
