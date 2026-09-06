output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.server.id
}

output "public_ip" {
  description = "Elastic Public IP of the EC2 instance"
  value       = aws_eip.server.public_ip
}

output "public_dns" {
  description = "Public DNS of the EC2 instance"
  value       = aws_eip.server.public_dns
}

output "ssh_command" {
  description = "SSH command to connect to instance"
  value       = "ssh -i ${var.ssh_key_name} admin@${aws_eip.server.public_ip}"
}
