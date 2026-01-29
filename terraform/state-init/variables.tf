variable "bucket_name" {
  description = "Name for the S3 bucket to store Terraform state"
  type        = string
}

variable "lock_table_name" {
  description = "Name for the DynamoDB table used for Terraform state locks"
  type        = string
}

variable "aws_region" {
  description = "AWS region for bootstrap resources"
  type        = string
  default     = "ca-central-1"
}

variable "tags" {
  description = "Tags applied to created resources"
  type        = map(string)
  default = {
    Environment = "dev"
    Project     = "healthdots"
    ManagedBy   = "Terraform"
  }
}
