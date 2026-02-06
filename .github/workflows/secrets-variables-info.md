# How Environment-Scoped Variables Work
When you set the `environment:` context in a job, both vars and secrets resolve to the environment-scoped values.

```yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Use variables
        run: echo "Region: ${{ vars.AWS_REGION }}"
```

# Variable Resolution Order
When you use `\${{ vars.VARIABLE_NAME }}`:

- If `environment:` is set -> uses environment-scoped variable
- If not found in environment -> falls back to repository-level variable
- If not found in repo -> falls back to organization-level variable

Same for `\${{ secrets.SECRET_NAME }}`.

# The `$VARIABLE` Syntax

```yml
steps:
  - name: Example
    run: |
      echo $AWS_REGION  # Shell environment variable
      echo ${{ vars.AWS_REGION }}  # GitHub Actions context variable
    env:
      AWS_REGION: ${{ vars.AWS_REGION }}  # Maps GitHub var to shell env var
```

Pattern:
- `\${{ vars.AWS_REGION }}` -> GitHub Actions context
- `env:` block -> maps to shell environment variable
- `$AWS_REGION` -> shell access

# Complete Example Showing Both

```yml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [dev, staging, production]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
      - uses: actions/checkout@v4

      # Method 1: Direct reference (Actions context)
      - name: Direct reference
        run: |
          echo "Bucket from GitHub context: ${{ vars.S3_BUCKET_NAME }}"
          echo "Region from GitHub context: ${{ vars.AWS_REGION }}"

      # Method 2: Via env block (preferred for scripts)
      - name: Via environment variables
        run: |
          echo "Bucket from shell env: $S3_BUCKET"
          echo "Region from shell env: $AWS_REGION"
          echo "API from shell env: $API_URL"

          aws s3 ls s3://$S3_BUCKET
        env:
          S3_BUCKET: ${{ vars.S3_BUCKET_NAME }}
          AWS_REGION: ${{ vars.AWS_REGION }}
          API_URL: ${{ vars.API_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

# What Gets Set Where
In GitHub UI: Settings -> Environments -> production

Variables:
- AWS_REGION = us-east-1
- S3_BUCKET_NAME = myapp-prod
- API_URL = https://api.myapp.com

Secrets:
- AWS_ACCESS_KEY_ID = AKIA...
- AWS_SECRET_ACCESS_KEY = secret...

In GitHub UI: Settings -> Secrets and variables -> Actions -> Variables

Repository-level variables:
- APP_NAME = myapp (shared across all environments)
- ORG_ID = 123456 (shared across all environments)

# Key Takeaways
- `\${{ vars.VARIABLE }}` uses environment-scoped vars when `environment:` is set
- `$VARIABLE` is a shell environment variable (set in `env:`)
- Best practice: use `env:` to map GitHub vars/secrets to shell vars
- `environment:` determines whether values are environment-scoped or repo-level
