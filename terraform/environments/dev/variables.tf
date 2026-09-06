# --- General / AWS ---
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile name"
  type        = string
}

# --- S3 Module Variables ---
variable "s3_bucket_name" {
  description = "Global unique name for the S3 bucket"
  type        = string
}

variable "s3_environment" {
  description = "Environment name for S3 bucket"
  type        = string
  default     = "Dev"
}

# --- EC2 Module Variables ---
variable "ec2_instance_name" {
  description = "Name of the EC2 instance"
  type        = string
  default     = "debian-server"
}

variable "ec2_instance_type" {
  description = "Type of EC2 instance to launch"
  type        = string
  default     = "t3.nano"
}

variable "ec2_ssh_key_name" {
  description = "Existing aws key pair name"
  type        = string
}

variable "ec2_allowed_ssh_ip" {
  description = "Allowed IPs for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ec2_root_volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 20
}

# --- RDS Postgres Module Variables ---
variable "rds_postgres_db_name" {
  description = "Initial database name"
  type        = string
  default     = "dbname"
}

variable "rds_postgres_db_username" {
  description = "Database username"
  type        = string
  default     = "dbuser"
}

variable "rds_postgres_db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "rds_postgres_db_instance_class" {
  description = "RDS Instance type"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_postgres_db_allocated_storage" {
  description = "Storage in GB"
  type        = number
  default     = 20
}

variable "rds_postgres_allowed_ip" {
  description = "Your public IP"
  type        = string
  default     = "0.0.0.0/0"
}

# --- ElastiCache Module Variables ---
variable "elasticache_cache_name" {
  description = "Unique name for the ElastiCache Valkey Serverless cache"
  type        = string
  default     = "redisdb"
}

variable "elasticache_major_engine_version" {
  description = "Valkey major engine version"
  type        = string
  default     = "8"
}

variable "elasticache_allowed_cidr" {
  description = "CIDR block allowed to access the cache"
  type        = string
  default     = "0.0.0.0/0"
}

variable "elasticache_max_storage_gb" {
  description = "Maximum data storage in GB"
  type        = number
  default     = 1
}

variable "elasticache_max_ecpu_per_second" {
  description = "Maximum ECPUs per second"
  type        = number
  default     = 1000
}

variable "elasticache_snapshot_retention_limit" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 0
}

variable "elasticache_environment" {
  description = "Environment tag"
  type        = string
  default     = "Dev"
}
