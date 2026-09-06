variable "bucket_name" {
  description = "Global unique name for the S3 bucket"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "Dev"
}
