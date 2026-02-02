// Minimal backend declaration so `terraform init -reconfigure -backend-config=...`
// can override it in this subfolder. This prevents the "Missing backend
// configuration" warning when running init with -backend-config here.

terraform {
  backend "s3" {}
}

// Provide concrete backend values on the CLI (example):
// terraform init -reconfigure \
//   -backend-config="bucket=healthdots-portfolio-terraform-state" \
//   -backend-config="key=portfolio/terraform.tfstate" \
//   -backend-config="region=ca-central-1" \
//   -backend-config="dynamodb_table=healthdots-portfolio-terraform-locks" \
//   -backend-config="encrypt=true"
