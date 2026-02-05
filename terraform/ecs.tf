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
}

# CloudWatch Log Group for ECS tasks
resource "aws_cloudwatch_log_group" "ecs_tasks" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-logs"
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
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy for ECS task execution to read secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name_prefix = "${var.environment}-${var.project_name}-ecs-secrets-"
  role        = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.postgres_connection.arn,
          aws_secretsmanager_secret.github_models_api_token.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.secrets.arn
      }
    ]
  })
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
}

# Task role policy for S3, SSM, and other app needs
resource "aws_iam_role_policy" "ecs_task_permissions" {
  name_prefix = "${var.environment}-${var.project_name}-ecs-task-policy-"
  role        = aws_iam_role.ecs_task.id

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
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/${var.environment}/${var.project_name}/*"
      }
    ]
  })
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

# KMS Key for Secrets Manager
resource "aws_kms_key" "secrets" {
  description             = "KMS key for Secrets Manager encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-secrets-key"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.environment}-${var.project_name}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# Secrets Manager - Postgres Connection String
resource "aws_secretsmanager_secret" "postgres_connection" {
  name_prefix             = "${var.environment}-${var.project_name}-postgres-connection-"
  description             = "PostgreSQL connection string for Portfolio API"
  kms_key_id              = aws_kms_key.secrets.id
  recovery_window_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-postgres-connection"
    Environment = var.environment
  }
}

# Placeholder secret value - update manually or via workflow
resource "aws_secretsmanager_secret_version" "postgres_connection" {
  secret_id = aws_secretsmanager_secret.postgres_connection.id
  secret_string = jsonencode({
    connection_string = "PLACEHOLDER - Update this value with actual connection string"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Secrets Manager - GitHub Models API Token
resource "aws_secretsmanager_secret" "github_models_api_token" {
  name_prefix             = "${var.environment}-${var.project_name}-github-models-token-"
  description             = "GitHub Models API token for Portfolio API"
  kms_key_id              = aws_kms_key.secrets.id
  recovery_window_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-github-models-token"
    Environment = var.environment
  }
}

# Placeholder secret value - update manually or via workflow
resource "aws_secretsmanager_secret_version" "github_models_api_token" {
  secret_id = aws_secretsmanager_secret.github_models_api_token.id
  secret_string = jsonencode({
    api_token = "PLACEHOLDER - Update this value with actual API token"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
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
        }
      ]

      secrets = [
        {
          name      = "ConnectionStrings__Postgres"
          valueFrom = "${aws_secretsmanager_secret.postgres_connection.arn}:connection_string::"
        },
        {
          name      = "GitHubModels__ApiToken"
          valueFrom = "${aws_secretsmanager_secret.github_models_api_token.arn}:api_token::"
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
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public.id, aws_subnet.public_2b.id]

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# Additional public subnet in second AZ for ALB
resource "aws_subnet" "public_2b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.3.0/24"
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
    interval            = 30
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

# HTTPS Listener (requires ACM certificate - see variable)
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.portfolio_api.arn
  }
}

# Listener rule for path-based routing (portfolio-{environment})
resource "aws_lb_listener_rule" "portfolio_api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.portfolio_api.arn
  }

  condition {
    path_pattern {
      values = ["/portfolio-${var.environment}/*"]
    }
  }
}
