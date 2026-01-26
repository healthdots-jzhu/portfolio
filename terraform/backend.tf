// Minimal backend declaration so `terraform init -reconfigure -backend-config=...`
// overrides apply to an explicitly-declared backend instead of the implicit
// local backend (avoids the "Missing backend configuration" warning).

terraform {
	backend "s3" {}
}

// Provide concrete backend values via the CLI, for example:
// terraform init -reconfigure \
//   -backend-config="bucket=your-bucket" \
//   -backend-config="key=portfolio/terraform.tfstate" \
//   -backend-config="region=ca-central-1" \
//   -backend-config="dynamodb_table=your-lock-table" \
//   -backend-config="encrypt=true"
