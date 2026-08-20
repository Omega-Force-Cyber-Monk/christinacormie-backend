data "aws_ami" "debian12" {
  most_recent = true

  owners = ["136693071363"]

  filter {
    name = "name"

    values = [
      "debian-12-amd64-*"
    ]
  }

  filter {
    name = "virtualization-type"

    values = [
      "hvm"
    ]
  }
}
