# React App Deployment Guide - AWS S3 + CloudFront with GitHub Actions

## Overview
This guide documents deployment of the React SPA using:
- S3 for static hosting (private)
- CloudFront for CDN and HTTPS
- GitHub Actions with OIDC (no long-lived AWS keys)

Project defaults:
- S3 Bucket: `healthdots-portfolio-web-app-001`
- Region: `ca-central-1`

## Architecture
```
User -> CloudFront (HTTPS) -> S3 (private)
```

## Initial AWS Setup

### Step 1: Create S3 Bucket
- Create bucket in `ca-central-1`
- Block all public access

### Step 2: Create CloudFront Distribution (Recommended: OAC)
- Origin: use the S3 REST endpoint (not the website endpoint)
- Origin Access Control (OAC): enable
- Viewer protocol policy: Redirect HTTP to HTTPS
- Default root object: `index.html`

### Step 3: Configure SPA Error Pages
CloudFront -> Error pages:
- 403 -> `/index.html` -> 200
- 404 -> `/index.html` -> 200

### Step 4: ACM Certificate (Optional Custom Domain)
- Request certificate in us-east-1
- Add validation records to DNS
- Attach cert to CloudFront distribution

## GitHub Actions OIDC Setup
See `terraform/ci_aws_oidc/README.md` for recommended setup. Ensure your role allows:
- `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`
- `cloudfront:CreateInvalidation`

## Deployment Workflow
Example workflow (see `.github/workflows/3- frontend-deploy.yml`):
- Build React app
- Sync build output to S3
- Invalidate CloudFront cache

## Notes
- Use CloudFront domain for `VITE_CDN_URL`
- API base URL is `https://api.healthdots.net/portfolio-__ENVIRONMENT__/content`
