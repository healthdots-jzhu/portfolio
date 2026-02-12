# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-cluster"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# CloudWatch Log Group for ECS tasks
resource "aws_cloudwatch_log_group" "ecs_tasks" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-logs"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ECS Task Execution Role (for pulling images and writing logs)
resource "aws_iam_role" "ecs_task_execution" {
  name_prefix = "${var.environment}-${var.project_name}-ecs-exec-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-exec-role"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"

  lifecycle {
    prevent_destroy = true
  }
}

# Additional policy for ECS task execution to read secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name_prefix = "${var.environment}-${var.project_name}-ecs-secrets-"
  role        = aws_iam_role.ecs_task_execution.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          data.aws_secretsmanager_secret.postgres_connection.arn,
          data.aws_secretsmanager_secret.github_models_api_token.arn
        ]
      },
    ]
  })

  lifecycle {
    prevent_destroy = true
  }
}

# ECS Task Role (for application runtime permissions like S3, SSM)
resource "aws_iam_role" "ecs_task" {
  name_prefix = "${var.environment}-${var.project_name}-ecs-task-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-task-role"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Task role policy for S3, SSM, and other app needs
resource "aws_iam_role_policy" "ecs_task_permissions" {
  name_prefix = "${var.environment}-${var.project_name}-ecs-task-policy-"
  role        = aws_iam_role.ecs_task.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_bucket_name}",
          "arn:aws:s3:::${var.s3_bucket_name}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:parameter/${var.environment}/${var.project_name}/*",
          "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/*"
        ]
      }
    ]
  })

  lifecycle {
    prevent_destroy = true
  }
}

# Security Group for ECS tasks
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.environment}-${var.project_name}-ecs-tasks-"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow HTTP from ALB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Allow ECS tasks to connect to RDS
resource "aws_security_group_rule" "rds_from_ecs" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ecs_tasks.id
  description              = "Allow PostgreSQL from ECS tasks"
}

# Using AWS-managed KMS for Secrets Manager (aws/secretsmanager). No customer CMK created here.

# Secrets Manager - Postgres Connection String
# Use data lookup to avoid attempting creation when the secret already exists.
data "aws_secretsmanager_secret" "postgres_connection" {
  name = "${var.project_name}-${var.environment}-postgres-connection"
}

# Secrets Manager - GitHub Models API Token
data "aws_secretsmanager_secret" "github_models_api_token" {
  name = "${var.project_name}-${var.environment}-github-models-token"
}

# ECS Task Definition
resource "aws_ecs_task_definition" "portfolio_api" {
  family                   = "${var.project_name}-${var.environment}-portfolio-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "portfolio-api"
      image     = "${aws_ecr_repository.portfolio_api.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "ASPNETCORE_ENVIRONMENT"
          value = title(var.environment)
        },
        {
          name  = "ASPNETCORE_URLS"
          value = "http://+:80"
        },
        {
          name  = "PATH_BASE"
          value = var.path_base
        }
      ]

      secrets = [
        {
          name      = "ConnectionStrings__Postgres"
          valueFrom = data.aws_secretsmanager_secret.postgres_connection.arn
        },
        {
          name      = "GitHubModels__ApiToken"
          valueFrom = data.aws_secretsmanager_secret.github_models_api_token.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_tasks.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "portfolio-api"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-portfolio-api-task"
  }
}

# ECS Service
resource "aws_ecs_service" "portfolio_api" {
  name            = "${var.project_name}-${var.environment}-portfolio-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.portfolio_api.arn
  desired_count   = var.ecs_service_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.private_app_2a.id, aws_subnet.private_app_2b.id]
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.portfolio_api.arn
    container_name   = "portfolio-api"
    container_port   = 80
  }

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy.ecs_secrets_access
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-portfolio-api-service"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Application Auto Scaling: keep 1 task normally, scale up to 3 based on CPU
resource "aws_appautoscaling_target" "portfolio_api" {
  service_namespace    = "ecs"
  resource_id          = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.portfolio_api.name}"
  scalable_dimension   = "ecs:service:DesiredCount"
  min_capacity         = 1
  max_capacity         = 3
}

resource "aws_appautoscaling_policy" "portfolio_api_cpu" {
  name               = "${var.project_name}-${var.environment}-portfolio-api-cpu-tt"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.portfolio_api.resource_id
  scalable_dimension = aws_appautoscaling_target.portfolio_api.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value       = 85.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public.id, aws_subnet.public_2b.id]

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = "${var.project_name}/${var.environment}/alb"
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }

  depends_on = [aws_s3_bucket_policy.alb_logs]
}

# Additional public subnet in second AZ for ALB
resource "aws_subnet" "public_2b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_2b_cidr
  availability_zone       = "ca-central-1b"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public2b-subnet"
  }
}

resource "aws_route_table_association" "public_2b" {
  subnet_id      = aws_subnet.public_2b.id
  route_table_id = aws_route_table.public.id
}

# Security Group for ALB
resource "aws_security_group" "alb" {
  name_prefix = "${var.environment}-${var.project_name}-alb-"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTP from internet"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS from internet"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

# Target Group for Portfolio API
resource "aws_lb_target_group" "portfolio_api" {
  name_prefix = "pf-api"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 300
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-portfolio-api-tg"
  }
}

# HTTP Listener (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

locals {
  # number of configured certificate ARNs
  acm_count = length(var.acm_certificate_arns)

  # clamp the API index into 0..acm_count-1 when there are ARNs
  # Use min/max and reference local.acm_count to avoid parser errors
  api_index = local.acm_count > 0 ? min(max(var.api_certificate_arn_index, 0), local.acm_count - 1) : 0

  # ordered list: put the selected API certificate first, then the remaining ARNs in their original order
  ordered_acm_certificate_arns = local.acm_count == 0 ? [] : concat([element(var.acm_certificate_arns, local.api_index)], [for i, a in var.acm_certificate_arns : a if i != local.api_index])
}

# HTTPS Listener (requires ACM certificate - see variable)
resource "aws_lb_listener" "https" {
  count             = length(var.acm_certificate_arns) > 0 ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  # Attach the selected API certificate (first in ordered list).
  # The resource is created only when there are ACM ARNs (see count above),
  # so referencing element(var.acm_certificate_arns, local.api_index) is safe.
  certificate_arn = element(var.acm_certificate_arns, local.api_index)

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

# Attach remaining ACM certs to the listener (SNI)
resource "aws_lb_listener_certificate" "extra" {
  for_each = { for idx, arn in var.acm_certificate_arns : idx => arn if idx != local.api_index }

  listener_arn    = aws_lb_listener.https[0].arn
  certificate_arn = each.value
}

# Ensure ECS service-linked role exists so ECS can create services
resource "aws_iam_service_linked_role" "ecs" {
  aws_service_name = "ecs.amazonaws.com"
  description      = "Service-linked role for Amazon ECS"
}

# Listener rule for path-based routing (portfolio-{environment})
resource "aws_lb_listener_rule" "portfolio_api" {
  listener_arn = length(aws_lb_listener.https) > 0 ? aws_lb_listener.https[0].arn : ""
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.portfolio_api.arn
  }

  condition {
    host_header {
      values = ["${var.api_subdomain}.${var.route53_zone_name}"]
    }
  }

  condition {
    path_pattern {
      values = ["/portfolio-${var.environment}/content/*"]
    }
  }
}

# Route53 record for API subdomain

// S3 bucket to receive ALB access logs
resource "aws_s3_bucket" "alb_logs" {
  bucket = "${var.project_name}-${var.environment}-alb-logs"

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-logs"
  }
}

# Bucket ownership controls - required for ALB logs
resource "aws_s3_bucket_ownership_controls" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# Versioning for ALB logs bucket (moved from inline argument)
resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption for ALB logs bucket (moved from inline argument)
resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSLogDeliveryWrite"
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Sid    = "AWSLogDeliveryAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.alb_logs.arn
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.alb_logs]
}

# Separate lifecycle configuration for the ALB logs bucket (replacement for
# deprecated lifecycle_rule inside aws_s3_bucket)
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "logs"
    status = "Enabled"

    filter {}

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 365
    }
  }
}

data "aws_route53_zone" "selected" {
  name         = var.route53_zone_name
  private_zone = false
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.api_subdomain
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = false
  }
}
