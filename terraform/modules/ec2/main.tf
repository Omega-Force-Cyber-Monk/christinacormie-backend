data "aws_vpc" "default" {
    default = true 
}

# subnet
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "ec2" {
  name        = "${var.instance_name}-sg"
  description = "Security group for EC2 instance"

  vpc_id = data.aws_vpc.default.id

  # ssh 
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22

    protocol = "tcp"

    cidr_blocks = var.allowed_ssh_ip
  }

  # http
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80

    protocol = "tcp"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  # https
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443

    protocol = "tcp"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  # outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ec2
resource "aws_instance" "server" {
  ami           = data.aws_ami.debian12.id
  instance_type = var.instance_type
  subnet_id     = data.aws_subnets.default.ids[0]

  vpc_security_group_ids = [
    aws_security_group.ec2.id
  ]

  key_name = var.ssh_key_name

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true

    delete_on_termination = true
  }

  tags = {
    Name = var.instance_name
  }
}

# elastic ip
resource "aws_eip" "server" {
  instance = aws_instance.server.id

  tags = {
    Name = "${var.instance_name}-eip"
  }
  depends_on = [
    aws_instance.server
  ]
}
