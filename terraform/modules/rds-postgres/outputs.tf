output "database_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "database_port" {
  value = aws_db_instance.postgres.port
}

output "database_name" {
  value = aws_db_instance.postgres.db_name
}

output "database_username" {
  value = aws_db_instance.postgres.username
}

output "connection_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
  sensitive = true
}

