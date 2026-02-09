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
        "ecr:BatchDeleteImage",
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

  # Allow EC2 image lookups used by Terraform when resolving AMIs
  statement {
    actions = ["ec2:DescribeImages"]
    resources = ["*"]
  }

  # Allow various read/list/describe actions Terraform uses during plan
  statement {
    actions = [
      "route53:ListHostedZones",
      "route53:ListHostedZonesByName",
      "route53:ListResourceRecordSets",
      "route53:GetHostedZone",
      "route53:ListTagsForResource",
      "ec2:DescribeVpcs",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeVpcAttribute",
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeRouteTables",
      "ec2:DescribeAvailabilityZones",
      "ec2:DescribeVpcEndpoints",
      "ec2:DescribeInternetGateways",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeInstances",
      "ec2:DescribeTags",
      "ec2:DescribeInstanceAttribute",
      "ec2:DescribeInstanceStatus",
      "ec2:DescribeInstanceCreditSpecifications",
      "ec2:DescribePlacementGroups",
      "ec2:DescribeSnapshots",
      "ec2:DescribeVolumes",
      "ec2:DescribeKeyPairs",
      "ec2:DescribeTargetHealth",
      "ec2:DescribePrefixLists",
      "iam:GetRole",
      "iam:PutRolePolicy",
      "iam:TagInstanceProfile",
      "iam:ListRolePolicies",
      "iam:DetachRolePolicy",
      "iam:ListRoles",
      "iam:GetRolePolicy",
      "iam:GetInstanceProfile",
      "iam:ListAttachedRolePolicies",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "rds:DescribeDBParameterGroups",
      "rds:DescribeDBParameters",
      "rds:ListTagsForResource",
      "rds:DescribeDBInstances",
      "rds:DescribeDBSubnetGroups",
      "ssm:DescribeParameters",
      "ssm:ListTagsForResource",
      "ssm:GetParametersByPath",
      "ssm:GetParameterHistory",
      "ssm:DescribeInstanceInformation",
      "kms:DescribeKey",
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:ListAliases",
      "kms:ListResourceTags",
      "kms:ListKeys",
      "ecr:ListTagsForResource",
      "ecr:GetLifecyclePolicy",
      "ecr:PutLifecyclePolicy",
      "ecr:DeleteLifecyclePolicy",
      "ecr:BatchDeleteImage",
      "ecr:DeleteRepository",
      "events:DescribeRule",
      "events:ListTagsForResource",
      "events:ListTargetsByRule",
      "events:ListRules",
      "events:PutRule",
      "events:PutTargets",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeTargetGroups",
      "elasticloadbalancing:DescribeListeners",
      "elasticloadbalancing:DescribeRules",
      "elasticloadbalancing:DescribeTags",
      "elasticloadbalancing:CreateLoadBalancer",
      "elasticloadbalancing:CreateTargetGroup",
      "elasticloadbalancing:CreateListener",
      "elasticloadbalancing:CreateRule",
      "elasticloadbalancing:DeleteTargetGroup",
      "elasticloadbalancing:ModifyTargetGroupAttributes",
      "elasticloadbalancing:AddTags",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:GetLogEvents",
      "logs:ListTagsForResource",
      "logs:CreateLogGroup",
      "logs:PutRetentionPolicy",
      "logs:TagResource",
      "lambda:ListFunctions",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:GetPolicy",
      "lambda:ListVersionsByFunction",
      "lambda:ListTags",
      "lambda:ListAliases",
      "lambda:ListLayerVersions",
      "lambda:GetFunctionCodeSigningConfig",
      "lambda:GetLayerVersion",
      "lambda:GetLayerVersionPolicy",
      "application-autoscaling:DescribeScalableTargets",
      "application-autoscaling:DescribeScalingPolicies",
      "ecs:CreateCluster",
      "ecs:CreateService",
      "ecs:RegisterTaskDefinition",
      "ecs:DescribeClusters",
      "ecs:ListClusters",
      "ecs:DescribeServices",
      "ecs:ListServices",
      "ecs:DescribeTaskDefinition",
      "ecs:ListTaskDefinitions",
      "ecs:DescribeTasks",
      "ecs:ListTasks",
      "ecs:TagResource",
      "rds:CreateDBParameterGroup",
      "rds:CreateDBSubnetGroup",
      "rds:AddTagsToResource",
      "secretsmanager:TagResource",
      "ssm:AddTagsToResource",
      "ssm:DeleteParameter",
      "ssm:PutParameter",
      "iam:ListInstanceProfilesForRole",
      "iam:CreateRole",
      "iam:TagRole",
      "iam:AttachRolePolicy",
      "iam:CreateInstanceProfile",
      "iam:PutRolePolicy",
      "iam:TagInstanceProfile",
      "iam:AddRoleToInstanceProfile",
      "iam:RemoveRoleFromInstanceProfile",
      "iam:DeleteRole",
      "iam:DeleteRolePolicy",
      "ec2:CreateSubnet",
      "ec2:CreateVpcEndpoint",
      "ec2:CreateSecurityGroup",
      "ec2:CreateRouteTable",
      "ec2:AssociateRouteTable",
      "ec2:DeleteSecurityGroup",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:DeleteRouteTableAssociation",
      "ec2:RevokeSecurityGroupEgress",
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:CreateTags",
      "ecs:DescribeClusters",
      "ecs:ListClusters",
      "ecs:DescribeServices",
      "ecs:ListServices",
      "ecs:DescribeTaskDefinition",
      "ecs:ListTaskDefinitions",
      "ecs:DescribeTasks",
      "ecs:ListTasks",
      "rds:DescribeDBSnapshots",
      "ecr:ListImages",
      "ecr:DescribeImageScanFindings",
      "kms:ListGrants",
      "iam:ListInstanceProfiles",
      "iam:ListInstanceProfileTags",
      "s3:GetBucketLocation",
      "secretsmanager:ListSecrets",
      "logs:DescribeMetricFilters",
      "logs:TestMetricFilter",
      "events:ListRules",
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

resource "aws_iam_role_policy_attachment" "attach_ci_policy" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.ci_policy.arn
}

output "role_arn" {
  value = aws_iam_role.github_actions_role.arn
}
