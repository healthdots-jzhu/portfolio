# Portfolio Locale Data Migration Guide

## Overview
This guide helps you migrate locale data from JSON files to the PostgreSQL database. This is the first step of integrating the frontend with the backend API.

## Prerequisites
- PostgreSQL 12+ installed and running
- Access to the portfolio database
- The Portfolio.Api backend deployed and running
- The AWS Cognito user ID of the portfolio owner (you)

## Steps

### 1. Find Your AWS User ID
First, you need to find the UUID of the user who will own these portfolios. You can find this in:
- AWS Cognito: Look for your user ID in the Cognito User Pool
- Or check the database: Run this query to see existing users
  ```sql
  SELECT id, email, subject FROM "Users" ORDER BY "CreatedAt" DESC;
  ```

### 2. Update the Migration Script
Edit the `migrate_locale_data.sql` file and replace `{AWS_USER_ID}` with your actual user UUID.

Example: If your user ID is `a1b2c3d4-e5f6-7890-abcd-ef1234567890`, change:
```sql
INSERT INTO "Portfolios" ("Id", "PersonId", "DisplayName", "Subdomain", "IsActive", "CreatedAt", "UpdatedAt", "OwnerId")
VALUES ('EU2O', 'karen-zhu-EU2O', 'Karen Zhu', 'karen-zhu', true, NOW(), NOW(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
```

### 3. Back Up Your Database
Before running any migration, always back up your database:
```powershell
pg_dump portfolio_db > backup_$(Get-Date -Format yyyyMMdd_HHmmss).sql
```

### 4. Run the Migration Script
Connect to your database and run the migration:
```powershell
psql -U postgres -d portfolio_db -f migrate_locale_data.sql
```

Or from within psql:
```sql
\i migrate_locale_data.sql
```

### 5. Verify the Migration
The script automatically runs a verification query at the end. You should see:
```
 id  | personid          | displayname  | locale_count |  languages  | asset_count
-----+-------------------+--------------+--------------+-------------+-------------
 EU2O | karen-zhu-EU2O    | Karen Zhu    |            2 | {en,fr}     |          25
 EU1O | jason-zhu-EU1O    | Jason Zhu    |            3 | {en,fr,zh}  |           8
```

This confirms:
- Portfolios were created
- Locale data was inserted for all languages
- Portfolio assets (images, videos) were registered

### 6. Test the API Endpoints
Before removing locale files from git, verify the API works for all languages:

**Test Karen's English and French:**
```powershell
Invoke-RestMethod http://localhost:5000/api/portfolios/karen-zhu-EU2O/locales/en
Invoke-RestMethod http://localhost:5000/api/portfolios/karen-zhu-EU2O/locales/fr
```

**Test Jason's English, French, and Chinese:**
```powershell
Invoke-RestMethod http://localhost:5000/api/portfolios/jason-zhu-EU1O/locales/en
Invoke-RestMethod http://localhost:5000/api/portfolios/jason-zhu-EU1O/locales/fr
Invoke-RestMethod http://localhost:5000/api/portfolios/jason-zhu-EU1O/locales/zh
```

All endpoints should return the full locale JSON with content in the respective languages.

### 7. Add Other Languages (Optional)
Once you've verified this works, you can add additional languages to Karen's portfolio if needed. The script includes:
- **Karen Zhu (EU2O)**: English (en) and French (fr)
- **Jason Zhu (EU1O)**: English (en), French (fr), and Chinese (zh)

## Next Steps
After verifying the migration is successful:
1. ✅ Migration script created with all languages
2. ⏳ **Wait for your confirmation before proceeding**
3. Update frontend to fetch from API instead of locale files
4. Remove locale files from git
5. Add login/authentication UI
6. Create portfolio management dashboard
7. Create portfolio editor with versioning
8. Implement staging/preview and publishing

## Rollback
If something goes wrong, you can rollback using the backup:
```powershell
psql -U postgres -d portfolio_db < backup_20260115_120000.sql
```

## Notes
- The migration uses `ON CONFLICT ... DO NOTHING` to safely handle re-runs
- Soft deletes are used (IsActive flag) rather than hard deletes
- All timestamps are in UTC
- The script preserves the PersonId as a natural key (unique per portfolio)
