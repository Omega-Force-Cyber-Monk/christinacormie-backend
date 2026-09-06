module "s3" {
  source      = "../../modules/s3"
  bucket_name = var.s3_bucket_name
  environment = var.s3_environment
}

module "rds_postgres" {
  source               = "../../modules/rds-postgres"
  db_name              = var.rds_postgres_db_name
  db_username          = var.rds_postgres_db_username
  db_password          = var.rds_postgres_db_password
  db_instance_class    = var.rds_postgres_db_instance_class
  db_allocated_storage = var.rds_postgres_db_allocated_storage
  allowed_ip           = var.rds_postgres_allowed_ip
}

module "elasticache" {
  source                   = "../../modules/elasticache"
  cache_name               = var.elasticache_cache_name
  major_engine_version     = var.elasticache_major_engine_version
  allowed_cidr             = var.elasticache_allowed_cidr
  max_storage_gb           = var.elasticache_max_storage_gb
  max_ecpu_per_second      = var.elasticache_max_ecpu_per_second
  snapshot_retention_limit = var.elasticache_snapshot_retention_limit
  environment              = var.elasticache_environment
}

module "ec2" {
  source           = "../../modules/ec2"
  instance_name    = var.ec2_instance_name
  instance_type    = var.ec2_instance_type
  ssh_key_name     = var.ec2_ssh_key_name
  allowed_ssh_ip   = var.ec2_allowed_ssh_ip
  root_volume_size = var.ec2_root_volume_size
}
