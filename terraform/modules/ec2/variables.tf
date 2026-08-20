#### EC2 Instance variables
variable "instance_name" {
  description = "Name of the EC2 instance."
  type        = string
  default     = "debian-server"
}

variable "instance_type" {
  description = "Type of EC2 instance to launch."
  type        = string
  default     = "t3.nano"
}

variable "ssh_key_name" {
  description = "Existing aws key pair name"
  type        = string
}

variable "allowed_ssh_ip" {
  description = "Allowed IPs for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "root_volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 20
}
