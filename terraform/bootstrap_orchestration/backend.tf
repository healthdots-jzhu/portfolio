// S3 backend configuration for bootstrap orchestration.
// This file contains the concrete backend values so local and CI runs
// consistently use the same remote state. If you prefer to pass values
// at init time, revert to an empty backend block and supply -backend-config
// flags on the CLI or in CI.

terraform {
  backend "s3" {
    bucket         = "healthdots-portfolio-terraform-state"
    key            = "portfolio/terraform.tfstate"
    region         = "ca-central-1"
    dynamodb_table = "healthdots-portfolio-terraform-locks"
    encrypt        = true
  }
}

// NOTE: backend values are literals and cannot use variables.
// If you need to change these values, update this file and run:
// terraform init -reconfigure -migrate-state
