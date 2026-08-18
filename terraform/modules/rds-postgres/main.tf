data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "postgres" {
  name        = "postgres-public"
  description = "Allow PostgreSQL"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "PostgreSQL"

    from_port = 5432
    to_port   = 5432

    protocol = "tcp"

    cidr_blocks = [
      var.allowed_ip
    ]
  }
  egress {
    from_port = 0
    to_port   = 0

    protocol = "-1"

    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "postgres" {
  name = "postgres-subnets"

  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_db_instance" "postgres" {
  identifier     = "postgres-db"
  engine         = "postgres"
  engine_version = "17.5"
  instance_class = var.db_instance_class

  allocated_storage   = var.db_allocated_storage
  storage_type        = "gp3"
  db_name             = var.db_name
  username            = var.db_username
  password            = var.db_password
  publicly_accessible = true

  db_subnet_group_name = aws_db_subnet_group.postgres.name

  vpc_security_group_ids = [
    aws_security_group.postgres.id
  ]

  skip_final_snapshot        = true
  deletion_protection        = false
  backup_retention_period    = 0
  auto_minor_version_upgrade = true
  apply_immediately          = true
  storage_encrypted          = true
  multi_az                   = false
}
