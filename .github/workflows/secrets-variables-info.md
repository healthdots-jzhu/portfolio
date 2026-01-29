# How Environment-Scoped Variables Work
When you set the environment: context in a job, both vars and secrets automatically resolve to the environment-scoped values, not repo-level.

```yml
yamljobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # This sets the context
    
    steps:
      - name: Use variables
        run: echo "Region: ${{ vars.AWS_REGION }}"
        # ☝️ This pulls from the 'production' environment variables
```

# Variable Resolution Order
When you use ${{ vars.VARIABLE_NAME }}:

If environment: is set → Uses environment-scoped variable
If not found in environment → Falls back to repository-level variable
If not found in repo → Falls back to organization-level variable

Same for ${{ secrets.SECRET_NAME }}.

# The $VARIABLE Syntax

```yml
yamlsteps:
  - name: Example
    run: |
      echo $AWS_REGION  # Shell environment variable
      echo ${{ vars.AWS_REGION }}  # GitHub Actions context variable
    env:
      AWS_REGION: ${{ vars.AWS_REGION }}  # Maps GitHub var to shell env var
   
```   

The pattern:
${{ vars.AWS_REGION }} → GitHub Actions accesses the variable
env: block → Maps it to a shell environment variable
$AWS_REGION → Shell accesses the environment variable

# Complete Example Showing Both

```yml
yamlname: Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [dev, staging, production]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}  # Sets context to dev/staging/prod
    
    steps:
      - uses: actions/checkout@v4
      
      # Method 1: Direct reference (works in GitHub Actions context)
      - name: Direct reference
        run: |
          echo "Bucket from GitHub context: ${{ vars.S3_BUCKET_NAME }}"
          echo "Region from GitHub context: ${{ vars.AWS_REGION }}"
      
      # Method 2: Via env block (preferred for complex scripts)
      - name: Via environment variables
        run: |
          echo "Bucket from shell env: $S3_BUCKET"
          echo "Region from shell env: $AWS_REGION"
          echo "API from shell env: $API_URL"
          
          # Use in actual commands
          aws s3 ls s3://$S3_BUCKET
        env:
          # Map GitHub vars/secrets to shell environment variables
          S3_BUCKET: ${{ vars.S3_BUCKET_NAME }}
          AWS_REGION: ${{ vars.AWS_REGION }}
          API_URL: ${{ vars.API_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

```

# What Gets Set Where
In GitHub UI: Settings → Environments → production

Variables:

    AWS_REGION = us-east-1
    S3_BUCKET_NAME = myapp-prod
    API_URL = https://api.myapp.com

Secrets:

    AWS_ACCESS_KEY_ID = AKIA...
    AWS_SECRET_ACCESS_KEY = secret...

In GitHub UI: Settings → Secrets and variables → Actions → Variables

Repository-level variables:

    APP_NAME = myapp (shared across all environments)
    ORG_ID = 123456 (shared across all environments)

## Practical Example

```yml
yamljobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    
    steps:
      # These pull from environment-scoped vars (because environment: is set)
      - name: Show environment config
        run: |
          echo "Environment-scoped region: ${{ vars.AWS_REGION }}"
          echo "Environment-scoped bucket: ${{ vars.S3_BUCKET_NAME }}"
          echo "Repo-level app name: ${{ vars.APP_NAME }}"
      
      # Recommended approach for actual deployment
      - name: Deploy
        run: |
          # Use shell variables for cleaner scripts
          aws configure set region $AWS_REGION
          aws s3 sync build/ s3://$S3_BUCKET --delete
          
          echo "Deployed $APP_NAME to $API_URL"
        env:
          # Environment-scoped (different per environment)
          AWS_REGION: ${{ vars.AWS_REGION }}
          S3_BUCKET: ${{ vars.S3_BUCKET_NAME }}
          API_URL: ${{ vars.API_URL }}
          
          # Repo-level (same across environments)
          APP_NAME: ${{ vars.APP_NAME }}
          
          # Secrets
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

```

# Key Takeaways

- ${{ vars.VARIABLE }} pulls from environment-scoped vars when environment: is set
- $VARIABLE is a shell environment variable (needs to be set in env: first)
- Best practice: Use env: block to map GitHub vars/secrets to shell variables for cleaner scripts
- The environment: field is what determines whether vars/secrets are environment-scoped or repo-level