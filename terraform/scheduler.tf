# Lambda function to start/stop EC2 and RDS instances
resource "aws_lambda_function" "resource_scheduler" {
  filename         = "${path.module}/lambda/scheduler.zip"
  function_name    = "${var.project_name}-${var.environment}-resource-scheduler"
  role            = aws_iam_role.lambda_scheduler.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.lambda_scheduler.output_base64sha256
  runtime         = "python3.12"
  timeout         = 60

  environment {
    variables = {
      EC2_INSTANCE_ID = aws_instance.main.id
      RDS_INSTANCE_ID = aws_db_instance.postgres-portfolio.identifier
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-scheduler"
  }
}

# Package Lambda function code
data "archive_file" "lambda_scheduler" {
  type        = "zip"
  output_path = "${path.module}/lambda/scheduler.zip"
  
  source {
    content  = file("${path.module}/lambda/scheduler.py")
    filename = "index.py"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_scheduler" {
  name_prefix = "${var.project_name}-lambda-scheduler-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-scheduler-role"
  }
}

# IAM Policy for Lambda to manage EC2 and RDS
resource "aws_iam_role_policy" "lambda_scheduler" {
  name_prefix = "${var.project_name}-scheduler-policy-"
  role        = aws_iam_role.lambda_scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:StartInstances",
          "ec2:StopInstances"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:StartDBInstance",
          "rds:StopDBInstance"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_scheduler" {
  name              = "/aws/lambda/${aws_lambda_function.resource_scheduler.function_name}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-scheduler-logs"
  }
}

# EventBridge Rule to stop resources at 12AM ET (5AM UTC during DST, 6AM UTC during standard time)
# Using 5AM UTC for simplicity - adjust as needed for DST changes
resource "aws_cloudwatch_event_rule" "stop_resources" {
  name                = "${var.project_name}-${var.environment}-stop-resources"
  description         = "Stop EC2 and RDS at 12AM ET daily"
  schedule_expression = "cron(0 5 * * ? *)"  # 12AM ET = 5AM UTC (during DST)

  tags = {
    Name = "${var.project_name}-${var.environment}-stop-rule"
  }
}

resource "aws_cloudwatch_event_target" "stop_resources" {
  rule      = aws_cloudwatch_event_rule.stop_resources.name
  target_id = "StopResources"
  arn       = aws_lambda_function.resource_scheduler.arn

  input = jsonencode({
    action = "stop"
  })
}

# EventBridge Rule to start resources at 9AM ET (2PM UTC during DST, 3PM UTC during standard time)
# Using 2PM UTC for simplicity - adjust as needed for DST changes
resource "aws_cloudwatch_event_rule" "start_resources" {
  name                = "${var.project_name}-${var.environment}-start-resources"
  description         = "Start EC2 and RDS at 9AM ET daily"
  schedule_expression = "cron(0 14 * * ? *)"  # 9AM ET = 2PM UTC (during DST)

  tags = {
    Name = "${var.project_name}-${var.environment}-start-rule"
  }
}

resource "aws_cloudwatch_event_target" "start_resources" {
  rule      = aws_cloudwatch_event_rule.start_resources.name
  target_id = "StartResources"
  arn       = aws_lambda_function.resource_scheduler.arn

  input = jsonencode({
    action = "start"
  })
}

# Lambda permissions for EventBridge
resource "aws_lambda_permission" "allow_eventbridge_stop" {
  statement_id  = "AllowExecutionFromEventBridgeStop"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resource_scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.stop_resources.arn
}

resource "aws_lambda_permission" "allow_eventbridge_start" {
  statement_id  = "AllowExecutionFromEventBridgeStart"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resource_scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.start_resources.arn
}
