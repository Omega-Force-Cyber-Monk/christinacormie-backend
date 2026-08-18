output "valkey_endpoint" {
  description = "ElastiCache Valkey Serverless endpoint hostname"
  value       = aws_elasticache_serverless_cache.valkey.endpoint[0].address
}

output "valkey_port" {
  description = "ElastiCache Valkey Serverless port"
  value       = aws_elasticache_serverless_cache.valkey.endpoint[0].port
}

output "redis_url" {
  description = "Full Redis connection URL — use this as REDIS_URL in your app"
  value       = "redis://${aws_elasticache_serverless_cache.valkey.endpoint[0].address}:${aws_elasticache_serverless_cache.valkey.endpoint[0].port}"
}
