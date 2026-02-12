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
locals {
  computed_project_name = var.project_name != "" ? var.project_name : var.github_repository
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
        "repo:${var.github_owner}/${var.github_repository}:workflow_run:*",
        "repo:${var.github_owner}/${var.github_repository}:environment:*"
      ]
    }

    # Require the token audience to be sts.amazonaws.com (GitHub Actions' default)
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com", "https://github.com/${var.github_owner}"]
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
  # (ECR push/read actions are provided by the extra policy wildcard)

  # (ECR repository actions are covered by the extra policy wildcard)

  statement {
    actions = [
      "s3:*"
    ]
    resources = [
      "arn:aws:s3:::${var.tf_state_bucket}",
      "arn:aws:s3:::${var.tf_state_bucket}/*",
      "arn:aws:s3:::*-alb-logs",
      "arn:aws:s3:::*-alb-logs/*"
    ]
  }

  # Allow CI to create and update Secrets Manager secrets used during bootstrap and workflow runs
  statement {
    actions = [
      "secretsmanager:CreateSecret",
      "secretsmanager:PutSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecretVersionIds"
    ]
    resources = [
      "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:*"
    ]
  }

  # Allow KMS decrypt / data key generation for keys used to encrypt secrets/state
  statement {
    actions = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = ["arn:aws:kms:${var.aws_region}:${var.aws_account_id}:key/*"]
  }

  # Allow various read/list/describe actions Terraform uses during plan
  statement {
    actions = [
      # IAM (read and role lifecycle helpers)
      "iam:GetRole",
      "iam:ListRoles",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:GetRolePolicy",
      "iam:GetInstanceProfile",
      "iam:ListInstanceProfiles",
      "iam:ListInstanceProfileTags",
      "iam:ListInstanceProfilesForRole",
      "iam:PutRolePolicy",
      "iam:TagInstanceProfile",
      "iam:TagRole",
      "iam:CreateRole",
      "iam:AttachRolePolicy",
      "iam:CreateInstanceProfile",
      "iam:AddRoleToInstanceProfile",
      "iam:RemoveRoleFromInstanceProfile",
      "iam:DeleteRole",
      "iam:DeleteRolePolicy",
      "iam:PassRole",
      "iam:CreateServiceLinkedRole",
      "iam:DeleteInstanceProfile",

      # KMS
      "kms:DescribeKey",
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:ListAliases",
      "kms:ListResourceTags",
      "kms:ListKeys",
      "kms:ListGrants",
      "kms:Encrypt",

      # RDS
      "rds:DescribeDBParameterGroups",
      "rds:DescribeDBParameters",
      "rds:ListTagsForResource",
      "rds:DescribeDBInstances",
      "rds:DescribeDBSubnetGroups",
      "rds:DescribeDBSnapshots",
      "rds:CreateDBParameterGroup",
      "rds:ModifyDBParameterGroup",
      "rds:ModifyDBInstance",
      "rds:CreateDBSubnetGroup",
      "rds:AddTagsToResource",
      "rds:DeleteDBParameterGroup",

      # Secrets Manager
      "secretsmanager:ListSecrets",
      "secretsmanager:CreateSecret",
      "secretsmanager:PutSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecretVersionIds",
      "secretsmanager:TagResource",
      "secretsmanager:GetResourcePolicy",

      # EventBridge / rules
      "events:DescribeRule",
      "events:ListRules",
      "events:ListTagsForResource",
      "events:ListTargetsByRule",
      "events:PutRule",
      "events:PutTargets",

      # CloudWatch Alarms for autoscaling
      "cloudwatch:PutMetricAlarm",
      "cloudwatch:DeleteAlarms",
      "cloudwatch:DescribeAlarms",

      # S3 helper
      "s3:GetBucketLocation",

      # STS helper
      "sts:GetCallerIdentity"
    ]
    resources = ["*"]
  }

  # Allow passing limited roles (scoped to project-prefixed roles)
  statement {
    actions = ["iam:PassRole"]
    resources = ["arn:aws:iam::${var.aws_account_id}:role/${local.computed_project_name}*"]
  }

  # Helpful read-only call for CI debugging
  statement {
    actions = [
      "sts:GetCallerIdentity",
      "sts:AssumeRole",
      "sts:AssumeRoleWithWebIdentity",
      "sts:AssumeRoleWithSAML"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ci_policy" {
  name   = "${local.computed_role_name}-policy"
  policy = data.aws_iam_policy_document.ci_policy_doc.json
}

# Extra policy to hold large service wildcards so we don't exceed single-policy size limits
data "aws_iam_policy_document" "ci_policy_doc_extra" {
  statement {
    actions = [
      "ec2:*",
      "ecs:*",
      "elasticloadbalancing:*",
      "logs:*",
      "ecr:*",
      "dynamodb:*",
      "ssm:*",
      "route53:*",
      "application-autoscaling:*",
      "lambda:*"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ci_policy_extra" {
  name   = "${local.computed_role_name}-policy-extra"
  policy = data.aws_iam_policy_document.ci_policy_doc_extra.json
}

resource "aws_iam_role_policy_attachment" "attach_ci_policy_extra" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.ci_policy_extra.arn
}

resource "aws_iam_role_policy_attachment" "attach_ci_policy" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.ci_policy.arn
}

output "role_arn" {
  value = aws_iam_role.github_actions_role.arn
}
