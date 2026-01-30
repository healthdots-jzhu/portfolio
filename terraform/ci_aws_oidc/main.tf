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

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_owner}/${var.github_repository}:ref:refs/heads/main"]
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
