variable "db_name" {
  description = "Initial database name"
  type        = string
  default     = "dbname"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "dbuser"
}

variable "db_password" {
  description = "Database password"
  type        = string
  default = "Chr!St!N"
}

variable "db_instance_class" {
  description = "RDS Instance type"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Storage in GB"
  type        = number
  default     = 20
}

variable "allowed_ip" {
  description = "Your public IP"
  type        = string
  default     = "0.0.0.0/0"
}
