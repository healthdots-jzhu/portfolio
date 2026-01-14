variable "aws_region" {
  type        = string
  description = "AWS region to deploy backend resources"
  default     = "ca-central-1"
}

variable "project_name" {
  type        = string
  description = "Project name used for tagging and bucket name prefix"
  default     = "portfolio"
}

variable "environment" {
  type        = string
  description = "Environment label for tagging"
  default     = "shared"
}

variable "bucket_name" {
  type        = string
  description = "Explicit S3 bucket name for Terraform state (lowercase, globally unique). If omitted, a name will be generated."
  default     = null
}

variable "table_name" {
  type        = string
  description = "DynamoDB table name for Terraform state locking"
  default     = "terraform-state-locks"
}

variable "sse_algorithm" {
  type        = string
  description = "S3 default encryption algorithm: AES256 or aws:kms"
  default     = "AES256"

  validation {
    condition     = contains(["AES256", "aws:kms"], var.sse_algorithm)
    error_message = "sse_algorithm must be either 'AES256' or 'aws:kms'"
  }
}

variable "kms_key_id" {
  type        = string
  description = "KMS Key ID/ARN for bucket encryption when sse_algorithm=aws:kms"
  default     = null
}
