output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.portfolio_api.name
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Route53 zone ID of the ALB"
  value       = aws_lb.main.zone_id
}

output "postgres_connection_secret_arn" {
  description = "ARN of Postgres connection string secret in Secrets Manager"
  value       = data.aws_secretsmanager_secret.postgres_connection.arn
  sensitive   = true
}

output "github_models_token_secret_arn" {
  description = "ARN of GitHub Models API token secret in Secrets Manager"
  value       = data.aws_secretsmanager_secret.github_models_api_token.arn
  
  sensitive   = true
}
