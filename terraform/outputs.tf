output "ec2_instance_id" {
  value       = aws_instance.main.id
  description = "EC2 instance ID"
}

output "ec2_instance_public_ip" {
  value       = aws_instance.main.public_ip
  description = "Public IP address of EC2 instance"
}

output "ec2_private_ip" {
  value       = aws_instance.main.private_ip
  description = "Private IP address of EC2 instance"
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres-portfolio.endpoint
  description = "RDS PostgreSQL endpoint (host:port)"
}

output "rds_address" {
  value       = aws_db_instance.postgres-portfolio.address
  description = "RDS PostgreSQL address (hostname only)"
}

output "rds_port" {
  value       = aws_db_instance.postgres-portfolio.port
  description = "RDS PostgreSQL port"
}

output "rds_database_name" {
  value       = aws_db_instance.postgres-portfolio.db_name
  description = "RDS database name"
}

output "ssm_session_command" {
  value       = "aws ssm start-session --target ${aws_instance.main.id} --region ${var.aws_region}"
  description = "Command to start SSM session with EC2 instance"
}

output "rds_connection_string" {
  value       = "postgresql://${var.rds_username}:****@${aws_db_instance.postgres-portfolio.address}:${aws_db_instance.postgres-portfolio.port}/${aws_db_instance.postgres-portfolio.db_name}"
  description = "PostgreSQL connection string (password hidden)"
  sensitive   = true
}

output "postgres_connection_via_ssm" {
  value       = "psql -h ${aws_db_instance.postgres-portfolio.address} -U ${var.rds_username} -d ${aws_db_instance.postgres-portfolio.db_name}"
  description = "psql command to connect to PostgreSQL via SSM session"
  sensitive   = true
}

# Scheduler Outputs
output "scheduler_lambda_function_name" {
  value       = aws_lambda_function.resource_scheduler.function_name
  description = "Lambda function name for resource scheduler"
}

output "scheduler_lambda_arn" {
  value       = aws_lambda_function.resource_scheduler.arn
  description = "Lambda function ARN for resource scheduler"
}

output "scheduler_stop_time" {
  value       = "12:00 AM ET (5:00 AM UTC during DST)"
  description = "Time when resources are stopped daily"
}

output "scheduler_start_time" {
  value       = "9:00 AM ET (2:00 PM UTC during DST)"
  description = "Time when resources are started daily"
}

output "scheduler_cloudwatch_logs" {
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#logsV2:log-groups/log-group/${replace(aws_cloudwatch_log_group.lambda_scheduler.name, "/", "$252F")}"
  description = "CloudWatch Logs URL for scheduler Lambda"
}
