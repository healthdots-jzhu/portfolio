terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Uncomment to use S3 backend for state
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "portfolio/terraform.tfstate"
  #   region         = "ca-central-1"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

# Public Subnet for EC2/ALB
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = "ca-central-1a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public1a-subnet"
  }
}

# Private Subnet for EC2/RDS
resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidr
  availability_zone = "ca-central-1a"

  tags = {
    Name = "${var.project_name}-${var.environment}-private1a-subnet"
  }
}

# Additional private subnets (pre-existing) to be managed by Terraform
resource "aws_subnet" "private_2a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.144.0/20"
  availability_zone = "ca-central-1a"

  tags = {
    Name = "${var.project_name}-${var.environment}-private2a-subnet"
  }
}

resource "aws_subnet" "private_2b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.160.0/20"
  availability_zone = "ca-central-1b"

  tags = {
    Name = "${var.project_name}-${var.environment}-private2b-subnet"
  }
}

# Route Table for Public Subnet
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security Group for EC2
resource "aws_security_group" "ec2" {
  name_prefix = "${var.project_name}-ec2-"
  description = "Security group for EC2 instance with SSM access"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-sg"
  }
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-postgresql-sg-1"
  description = "Security group for RDS PostgreSQL databases"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}

# Security Group for VPC Interface Endpoints (allow EC2 to reach endpoints over HTTPS)
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${var.project_name}-${var.environment}-vpce-"
  description = "Security group for VPC Interface Endpoints used by SSM"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-vpce-sg"
  }
}

# VPC Interface Endpoints for SSM in private subnets
resource "aws_vpc_endpoint" "ssm" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ssm"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [aws_subnet.private.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]

  tags = {
    Name = "${var.project_name}-${var.environment}-vpce-ssm"
  }
}

resource "aws_vpc_endpoint" "ssmmessages" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ssmmessages"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [aws_subnet.private.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]

  tags = {
    Name = "${var.project_name}-${var.environment}-vpce-ssmmessages"
  }
}

resource "aws_vpc_endpoint" "ec2messages" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ec2messages"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [aws_subnet.private.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]

  tags = {
    Name = "${var.project_name}-${var.environment}-vpce-ec2messages"
  }
}

# IAM Role for EC2 (SSM access)
resource "aws_iam_role" "ec2_ssm_role" {
  name_prefix = "${var.project_name}-ec2-ssm-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-ssm-role"
  }
}

# Attach SSM managed policy to EC2 role
resource "aws_iam_role_policy_attachment" "ssm_policy" {
  role       = aws_iam_role.ec2_ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name_prefix = "${var.project_name}-ec2-profile-"
  role        = aws_iam_role.ec2_ssm_role.name
}

# EC2 Instance (t4g.micro with Graviton2 processor)
resource "aws_instance" "main" {
  ami                    = data.aws_ami.amazon_linux_2.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.private.id
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  vpc_security_group_ids = [aws_security_group.ec2.id]

  # User data script to install PostgreSQL client and SSM Session Manager plugin
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    rds_endpoint = aws_db_instance.postgres-portfolio.endpoint
  }))

  monitoring              = true
  associate_public_ip_address = true

  tags = {
    Name = "${var.project_name}-${var.environment}-db-access-ec2-instance"
  }

  depends_on = [
    aws_db_instance.postgres-portfolio,
    aws_internet_gateway.main
  ]

  lifecycle {
    create_before_destroy = true
    replace_triggered_by  = [terraform_data.ec2_replace_when_ami_changes.id]
  }
}

# Trigger EC2 replacement when the latest Amazon Linux 2 AMI changes
resource "terraform_data" "ec2_replace_when_ami_changes" {
  triggers_replace = {
    ami = data.aws_ami.amazon_linux_2.id
  }
}

# Get latest Amazon Linux 2 AMI (ARM-based for t4g)
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-arm64-gp2"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# DB Parameter Group for PostgreSQL
resource "aws_db_parameter_group" "postgres" {
  name_prefix = "${var.project_name}-postgres-"
  family      = "postgres${var.postgres_version}"
  description = "Custom parameter group for PostgreSQL"

  parameter {
    name         = "max_connections"
    value        = "100"
    apply_method = "pending-reboot"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-params"
  }
}

# DB Subnet Group for RDS
resource "aws_db_subnet_group" "postgres" {
  name_prefix = "${var.project_name}-db-"
  subnet_ids  = [aws_subnet.private_2a.id, aws_subnet.private_2b.id]

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "postgres-portfolio" {
  identifier_prefix           = "${var.project_name}-${var.environment}-${var.rds_database_name}-postgres"
  engine                      = "postgres"
  engine_version              = var.postgres_version
  instance_class              = var.rds_instance_class
  allocated_storage            = var.rds_allocated_storage
  storage_type                = var.rds_storage_type
  db_name                     = var.rds_database_name
  username                    = var.rds_username
  manage_master_user_password = true
  master_user_secret_kms_key_id = aws_kms_key.rds.arn
  
  parameter_group_name        = aws_db_parameter_group.postgres.name
  db_subnet_group_name        = aws_db_subnet_group.postgres.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  
  skip_final_snapshot         = var.rds_skip_final_snapshot
  backup_retention_period     = var.rds_backup_retention_period
  multi_az                    = var.rds_multi_az
  publicly_accessible         = false
  storage_encrypted           = true
  kms_key_id                  = aws_kms_key.rds.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-${var.rds_database_name}-postgres"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# KMS Key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-key"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.project_name}-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# Generate random salt for Hashids (only once, then reused from state)
resource "random_password" "hashids_salt" {
  length  = 32
  special = true
}

# SSM Parameter for Hashids Salt (used by Portfolio API)
resource "aws_ssm_parameter" "hashids_salt" {
  name            = "/${var.project_name}/hashids/salt"
  description     = "Salt for Hashids ID generation"
  type            = "SecureString"
  value           = random_password.hashids_salt.result
  key_id          = aws_kms_key.rds.id

  tags = {
    Name = "${var.project_name}-${var.environment}-hashids-salt"
  }
}
