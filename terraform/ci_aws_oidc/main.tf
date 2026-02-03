provider "aws" {
  region = var.aws_region
}

# The OIDC provider resource is intentionally commented out:
# It should be created manually in the target AWS account before running
# this one-time backend provisioning workflow. Keep this block available
# for reference and possible future import into Terraform state.
/*
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}
*/

locals {
  computed_role_name = var.role_name != "" ? var.role_name : "${var.github_repository}-github-actions-oidc-ci-role"
}


# IAM role assumable by GitHub Actions via OIDC
data "aws_iam_policy_document" "assume_role_policy" {
  statement {
    effect = "Allow"
    principals {
      type = "Federated"
      # Use an externally-provisioned OIDC provider ARN. Provide
      # `existing_oidc_provider_arn` when running this module (this
      # avoids creating the provider in Terraform).
      identifiers = [var.existing_oidc_provider_arn]
    }

    # Allow only the main branch refs and workflow_run tokens for this repository
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [
        "repo:${var.github_owner}/${var.github_repository}:ref:refs/heads/main",
        "repo:${var.github_owner}/${var.github_repository}:workflow_run:*
"
      ]
    }

    # Require the token audience to be sts.amazonaws.com (GitHub Actions' default)
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]
  }
}

resource "aws_iam_role" "github_actions_role" {
  name               = local.computed_role_name
  assume_role_policy = data.aws_iam_policy_document.assume_role_policy.json

  tags = {
    CreatedBy = "terraform"
  }
}

# IAM policy granting necessary permissions for CI: ECR push, S3 state access, DynamoDB lock access
data "aws_iam_policy_document" "ci_policy_doc" {
  statement {
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart"
    ]
    resources = ["*"]
  }

  # Allow repository inspection/creation and image reads
  statement {
    actions = [
      "ecr:DescribeRepositories",
      "ecr:CreateRepository",
      "ecr:BatchGetImage",
      "ecr:DescribeImages"
    ]
    resources = ["arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/*"]
  }

  statement {
    actions = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
    resources = [
      "arn:aws:s3:::${var.tf_state_bucket}",
      "arn:aws:s3:::${var.tf_state_bucket}/*"
    ]
  }

  statement {
    actions   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem", "dynamodb:Query"]
    resources = ["arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.tf_state_dynamodb_table}"]
  }

  # Allow CI to describe the DynamoDB lock table
  statement {
    actions   = ["dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.tf_state_dynamodb_table}"]
  }

  # Allow reading SSM parameters and Secrets Manager secrets used by pipelines
  statement {
    actions = ["ssm:GetParameter", "ssm:GetParameters", "secretsmanager:GetSecretValue"]
    resources = [
      "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/*",
      "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:*"
    ]
  }

  # Allow KMS decrypt / data key generation for keys used to encrypt secrets/state
  statement {
    actions = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = ["arn:aws:kms:${var.aws_region}:${var.aws_account_id}:key/*"]
  }

  # Allow passing limited roles (scoped to project-prefixed roles)
  statement {
    actions = ["iam:PassRole"]
    resources = ["arn:aws:iam::${var.aws_account_id}:role/${var.project_name}*"]
  }

  # Helpful read-only call for CI debugging
  statement {
    actions = ["sts:GetCallerIdentity"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ci_policy" {
  name   = "${local.computed_role_name}-policy"
  policy = data.aws_iam_policy_document.ci_policy_doc.json
}

resource "aws_iam_role_policy_attachment" "attach_ci_policy" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.ci_policy.arn
}

output "role_arn" {
  value = aws_iam_role.github_actions_role.arn
}
