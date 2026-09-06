data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security group for ElastiCache Serverless
# Allows inbound Valkey traffic only from allowed CIDR (your EC2 or VPC range)
resource "aws_security_group" "valkey" {
  name        = "${var.cache_name}-sg"
  description = "Security group for ElastiCache Valkey Serverless"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Valkey / Redis"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.cache_name}-sg"
  }
}

# ElastiCache Serverless Cache (Valkey engine)
# Serverless = no node management, auto-scales, pay per usage only
resource "aws_elasticache_serverless_cache" "valkey" {
  name        = var.cache_name
  engine      = "valkey"
  description = "${var.cache_name} serverless valkey cache"

  major_engine_version = var.major_engine_version

  subnet_ids         = data.aws_subnets.default.ids
  security_group_ids = [aws_security_group.valkey.id]

  # Cost guardrails — prevents surprise bills
  cache_usage_limits {
    data_storage {
      maximum = var.max_storage_gb
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = var.max_ecpu_per_second
    }
  }

  snapshot_retention_limit = var.snapshot_retention_limit

  tags = {
    Name        = var.cache_name
    Environment = var.environment
  }
}
