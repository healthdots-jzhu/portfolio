#!/bin/bash
set -e

# Update system
yum update -y

# Ensure SSM Agent is present and running (covers cases where AMI lacks it or the service is stopped)
yum install -y amazon-ssm-agent
systemctl enable amazon-ssm-agent
systemctl restart amazon-ssm-agent

# Install PostgreSQL client
amazon-linux-extras install -y postgresql14

# Install AWS CLI v2 (handy for troubleshooting)
yum install -y curl unzip
curl "https://awscli.amazonaws.com/awscliv2.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install --update

# Log completion
echo "EC2 instance setup completed $(date -Ins)" >> /var/log/user-data.log
echo "PostgreSQL client, AWS CLI v2, and SSM Agent ensured running" >> /var/log/user-data.log
