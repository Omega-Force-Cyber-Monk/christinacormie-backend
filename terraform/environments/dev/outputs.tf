# ==============================================================================
# EC2 INSTANCE OUTPUTS
# ==============================================================================
output "ec2" {
  description = "EC2 Instance Details"
  value = {
    instance_id = module.ec2.instance_id
    public_ip   = module.ec2.public_ip
    public_dns  = module.ec2.public_dns
    ssh_command = module.ec2.ssh_command
  }
}

# ==============================================================================
# S3 BUCKET OUTPUTS
# ==============================================================================
output "s3" {
  description = "S3 Bucket Details"
  value = {
    bucket_name = module.s3.bucket_name
    bucket_arn  = module.s3.bucket_arn
  }
}

# ==============================================================================
# RDS POSTGRESQL OUTPUTS
# ==============================================================================
output "database" {
  description = "RDS PostgreSQL Details"
  value = {
    endpoint = module.rds_postgres.database_endpoint
    port     = module.rds_postgres.database_port
    db_name  = module.rds_postgres.database_name
    username = module.rds_postgres.database_username
  }
}

# ==============================================================================
# ELASTICACHE / VALKEY OUTPUTS
# ==============================================================================
output "elasticache" {
  description = "ElastiCache Valkey Details"
  value = {
    endpoint  = module.elasticache.valkey_endpoint
    port      = module.elasticache.valkey_port
    redis_url = module.elasticache.redis_url
  }
}
