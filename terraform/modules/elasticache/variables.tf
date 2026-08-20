variable "cache_name" {
  description = "Unique name for the ElastiCache Valkey Serverless cache"
  type        = string
  default     = "my-valkey"
}

variable "major_engine_version" {
  description = "Valkey major engine version"
  type        = string
  default     = "8"
}

variable "allowed_cidr" {
  description = "CIDR block allowed to access the cache (your EC2 private IP range or VPC CIDR)"
  type        = string
  default     = "0.0.0.0/0"
}

variable "max_storage_gb" {
  description = "Maximum data storage in GB (cost guardrail)"
  type        = number
  default     = 1
}

variable "max_ecpu_per_second" {
  description = "Maximum ECPUs per second (cost guardrail)"
  type        = number
  default     = 1000
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain snapshots. 0 = disabled (good for dev)"
  type        = number
  default     = 0
}

variable "environment" {
  description = "Environment tag (e.g. Dev, Prod)"
  type        = string
  default     = "Dev"
}
