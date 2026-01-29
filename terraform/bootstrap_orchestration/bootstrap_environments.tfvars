# Sample environments map for bootstrap_orchestration
# Replace values with your account-specific names/regions.

environments = {
  staging = {
    tf_state_key           = "terraform/staging.tfstate"
    tf_state_region        = "ca-central-1"
    ecr_registry           = "199061575177.dkr.ecr.ca-central-1.amazonaws.com/healthdots-portfolio-api"
    s3_bucket_frontend     = "Staging-healthdots-portfolio-web-app-001"
  }

  beta = {
    tf_state_key           = "terraform/beta.tfstate"
    tf_state_region        = "ca-central-1"
    ecr_registry           = "199061575177.dkr.ecr.ca-central-1.amazonaws.com/healthdots-portfolio-api"
    s3_bucket_frontend     = "healthdots-portfolio-web-app-001"
  }

  prod = {
    tf_state_key           = "terraform/prod.tfstate"
    tf_state_region        = "ca-central-1"
    ecr_registry           = "199061575177.dkr.ecr.ca-central-1.amazonaws.com/healthdots-portfolio-api"
    s3_bucket_frontend     = "healthdots-portfolio-web-app-001"
  }
}
