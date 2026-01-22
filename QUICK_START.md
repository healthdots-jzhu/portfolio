# Quick Start Guide - Portfolio Management System

## For First-Time Setup

### 1. Run Database Migration

```bash
cd APIs/Portfolio.Api
dotnet ef migrations add AddPortfolioVersioning
dotnet ef database update
```

### 2. Update appsettings.json (if needed)

Ensure your `appsettings.json` has the required AWS Cognito configuration:

```json
{
  "Aws": {
    "Region": "us-east-1",
    "Cognito": {
      "Authority": "https://cognito-idp.{region}.amazonaws.com/{userPoolId}",
      "Audience": ["your-client-id"]
    }
  }
}
```

### 3. Start Backend API

```bash
cd APIs/Portfolio.Api
dotnet run
```

The API will be available at: `http://localhost:5000`

### 4. Start Frontend

```bash
cd portfolio-frontend
npm install  # if first time
npm run dev
```

The frontend will be available at: `http://localhost:5173`

## First Login and Portfolio Setup

### Step 1: Navigate to Landing Page
- Go to `http://localhost:5173`
- Click the "Login" button (top right)

### Step 2: Authenticate
- Sign in with your AWS Cognito credentials
- You'll be redirected to `/portfolios`

### Step 3: Create Your First Portfolio
1. Click "+ Create New Portfolio"
2. Fill in:
   - **Display Name**: e.g., "Karen Zhu"
   - **Person ID** (optional): e.g., "karen-zhu-EU2O" (or leave blank for auto-generation)
   - **Subdomain** (optional): e.g., "karen"
3. Click "Create Portfolio"

### Step 4: Import Existing Locale Data

If you have existing locale JSON files (from `portfolio-frontend/src/locales/`), you can:

1. Click "Edit" on your portfolio
2. Select language (e.g., "en")
3. Copy-paste your locale JSON into the editor
4. Click "Save"
5. Repeat for other languages

Or run the migration SQL script (see below).

### Step 5: Create Initial Version
1. After saving all locales, click "Create Version"
2. Label: "Initial version"
3. Click "Create & Stage"
4. Click "Publish" to make it live

## Import Existing Data (Alternative Method)

If you have the migration SQL script already generated:

```bash
psql -h your-db-host -U your-db-user -d your-db-name -f migrate_locale_data.sql
```

This will:
- Create portfolios for Karen and Jason
- Import all locale data
- Create and publish initial versions

## Common Tasks

### Edit Portfolio Content
1. Go to `/portfolios`
2. Click "Edit" on desired portfolio
3. Select language from left sidebar
4. Edit JSON content
5. Click "Validate" to check for errors
6. Click "Save"

### Create a New Version
1. Ensure all changes are saved
2. Click "Create Version"
3. Enter label (optional): e.g., "Winter 2026 Update"
4. Enter description (optional)
5. Choose:
   - "Create Draft" - saves for later
   - "Create & Stage" - ready for preview

### Preview Changes
1. Create and stage a version
2. In version history, click "Preview"
3. New tab opens showing the staged version
4. Compare with live version

### Publish Changes
1. Find staged version in history
2. Click "Publish"
3. Confirm the action
4. Version is now live
5. Previous version is archived

## Testing the System

### Test Workflow 1: Simple Update
```
1. Login → /portfolios
2. Edit Karen's portfolio
3. Change tagline in EN locale
4. Save
5. Create Version (label: "Test Update")
6. Stage version
7. Preview in new tab
8. Publish
9. Verify live site shows new tagline
```

### Test Workflow 2: Multi-Version Staging
```
1. Edit portfolio
2. Make change A → Save → Create Version 1 → Stage
3. Revert change A, make change B → Save → Create Version 2 → Stage
4. Preview Version 1 in tab 1
5. Preview Version 2 in tab 2
6. Compare both
7. Publish preferred version
```

### Test Workflow 3: Validation
```
1. Edit portfolio
2. Remove required field (e.g., "name")
3. Click "Validate"
4. See error message
5. Fix error
6. Validate again
7. Should pass
```

## Troubleshooting

### Backend Not Starting
- Check PostgreSQL is running
- Verify connection string in appsettings.json
- Check AWS credentials are configured
- Look for migration errors in console

### Frontend Not Loading Portfolios
- Verify backend API is running at http://localhost:5000
- Check VITE_API_URL in .env file
- Open browser console for errors
- Verify authentication token in Network tab

### Can't Save Changes
- Ensure you're logged in (token not expired)
- Check browser console for API errors
- Verify personId matches your portfolio
- Check backend logs for detailed errors

### Version Not Showing in History
- Ensure version was created successfully
- Check API response in Network tab
- Reload version history (toggle sidebar)
- Verify database has PortfolioVersions table

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
```

### Backend (appsettings.json or environment)
```
ConnectionStrings__Postgres=Host=localhost;Database=portfolio;Username=postgres;Password=...
Aws__Region=us-east-1
Aws__Cognito__Authority=https://cognito-idp.us-east-1.amazonaws.com/{userPoolId}
Aws__Cognito__Audience__0={clientId}
```

## API Endpoints Quick Reference

### Public (No Auth Required)
- `GET /api/portfolios/{personId}` - Portfolio metadata
- `GET /api/portfolios/{personId}/locales/{language}` - Published locale content

### Authenticated
- `GET /api/portfolios` - User's portfolios
- `POST /api/portfolios` - Create portfolio
- `PUT /api/portfolios/{personId}/locales/{language}` - Update locale
- `GET /api/portfolios/{portfolioId}/versions` - Version history
- `POST /api/portfolios/{portfolioId}/versions` - Create version
- `POST /api/portfolios/{portfolioId}/versions/{versionId}/publish` - Publish
- `POST /api/portfolios/{portfolioId}/versions/{versionId}/stage` - Stage for preview
- `GET /api/portfolios/{personId}/preview/{versionId}/locales/{language}` - Preview version

## Next Steps

1. **Customize Validation**: Edit `LocaleValidator.cs` to add custom rules
2. **Add Languages**: Create new locale entries in database
3. **Brand Styling**: Update CSS files in `/pages/` directory
4. **Deploy**: Follow deployment guide for production setup

## Need Help?

- Check `PORTFOLIO_MANAGEMENT_GUIDE.md` for detailed documentation
- Review error messages in browser console
- Check backend logs for API errors
- Examine database for data issues
