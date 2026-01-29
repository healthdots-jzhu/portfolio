# Portfolio Management System - Complete Guide

## Overview

The portfolio management system now includes a complete versioning, staging, and preview system that allows portfolio owners to:

1. Manage multiple portfolios from a central dashboard
2. Edit locale files with real-time validation
3. Create versions of portfolio content
4. Stage changes for preview before publishing
5. Compare and manage multiple staged versions
6. Publish changes with full history tracking
7. Revert to previous versions if needed

## Features

### 1. Portfolio Dashboard (`/portfolios`)

After logging in, users are redirected to the portfolio management dashboard where they can:

- **View All Portfolios**: See all portfolios they own with metadata
- **Create New Portfolio**: Add new portfolios with custom person IDs and subdomains
- **Quick Actions**:
  - Edit: Navigate to the editor
  - Preview: Open the live portfolio in a new tab

**Navigation**: After successful login → `/portfolios`

### 2. Portfolio Editor (`/portfolio-editor/:personId`)

The editor provides a comprehensive interface for managing portfolio content:

#### Left Sidebar
- **Language Selector**: Switch between available languages (en, fr, etc.)
- **Version History** (toggleable):
  - View all versions with their status
  - See version numbers, labels, and creation dates
  - Quick actions for each version (Stage, Publish, Preview)

#### Main Editor Area
- **JSON Editor**: Edit locale content with syntax highlighting
- **Toolbar Actions**:
  - Format JSON: Auto-format the JSON content
  - Validate: Check content for errors and warnings
  - Save: Save changes to the current locale
- **Validation Feedback**: Real-time display of errors and warnings

#### Top Header
- **Preview Live**: Open the current published version in a new tab
- **Create Version**: Snapshot the current state into a new version
- **Show/Hide History**: Toggle version history sidebar

### 3. Version Management

#### Version States

1. **Draft**: Initial state when a version is created
   - Can be staged or published directly
   - Not visible to public

2. **Staged**: Ready for preview
   - Can be previewed via special URL
   - Multiple versions can be staged simultaneously
   - Can be published or unstaged

3. **Published**: Live version visible to public
   - Only one version can be published at a time
   - Publishing a new version archives the previous one
   - Updates the actual portfolio content

4. **Archived**: Previously published versions
   - Kept for history
   - Can be republished if needed

#### Creating Versions

1. Make and save changes to your locale files
2. Click "Create Version" in the editor header
3. Optional: Add a label and description
4. Choose to:
   - **Create Draft**: Save as draft for later
   - **Create & Stage**: Create and immediately stage for preview

#### Staging Workflow

1. **Stage a Version**: Mark a version as ready for preview
2. **Preview**: View staged version at `/{personId}?preview={versionId}`
3. **Compare**: Stage multiple versions to compare them
4. **Publish**: Make the version live when satisfied

### 4. Preview System

#### Preview Published Version
- URL: `/{personId}` (normal portfolio URL)
- Shows the currently published version
- Available to everyone

#### Preview Staged Version
- URL: `/{personId}?preview={versionId}`
- Requires authentication
- Opens in new browser tab
- Shows content from specific version

**Note**: The frontend needs to be updated to check for `?preview=` parameter and load the appropriate version content.

### 5. Validation System

The system validates locale content to prevent breaking changes:

#### Required Fields
- `name`: Portfolio owner's name
- `tagline`: Brief description
- `email`: Contact email

#### Structure Validation
- Checks that `sections` is an array
- Validates section structure (id, title)
- Checks `socialLinks` format
- Validates URLs (resumeLink, etc.)

#### Validation Levels
- **Errors**: Critical issues that must be fixed
- **Warnings**: Potential issues that should be reviewed

## Backend API Endpoints

### Version Status Enum

The system uses an integer-based enum for version status:
- `0` = Draft
- `1` = Staged  
- `2` = Published
- `3` = Archived

### Portfolio Management

- `GET /api/portfolios` - Get user's portfolios
- `GET /api/portfolios/{personId}` - Get portfolio metadata
- `POST /api/portfolios` - Create new portfolio
- `PUT /api/portfolios/{personId}` - Update portfolio
- `DELETE /api/portfolios/{personId}` - Soft delete portfolio

### Locale Management

- `GET /api/portfolios/{personId}/locales/{language}` - Get locale content
- `PUT /api/portfolios/{personId}/locales/{language}` - Update locale
- `GET /api/portfolios/{personId}/preview/{versionId}/locales/{language}` - Preview version

### Version Management

- `GET /api/portfolios/{portfolioId}/versions` - Get version history
- `GET /api/portfolios/{portfolioId}/versions/{versionId}` - Get version details
- `POST /api/portfolios/{portfolioId}/versions` - Create new version
- `POST /api/portfolios/{portfolioId}/versions/{versionId}/publish` - Publish version
- `POST /api/portfolios/{portfolioId}/versions/{versionId}/stage` - Stage version
- `POST /api/portfolios/{portfolioId}/versions/{versionId}/unstage` - Unstage version
- `GET /api/portfolios/{portfolioId}/versions/staged` - Get all staged versions
- `POST /api/portfolios/{portfolioId}/versions/validate` - Validate locale content

## Database Schema

### PortfolioVersion Table

```sql
CREATE TABLE PortfolioVersions (
    Id SERIAL PRIMARY KEY,
    PortfolioId VARCHAR(6) REFERENCES Portfolios(Id),
    VersionNumber INT NOT NULL,
    Status INTEGER NOT NULL, -- 0=Draft, 1=Staged, 2=Published, 3=Archived
    Label VARCHAR(200),
    ChangeDescription VARCHAR(2000),
    LocaleSnapshot JSONB NOT NULL, -- { "en": {...}, "fr": {...} }
    CreatedBy UUID REFERENCES Users(Id),
    CreatedAt TIMESTAMPTZ NOT NULL,
    PublishedAt TIMESTAMPTZ,
    PublishedBy UUID,
    IsCurrentPublished BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE UNIQUE INDEX idx_portfolio_version ON PortfolioVersions(PortfolioId, VersionNumber);
CREATE INDEX idx_portfolio_status ON PortfolioVersions(PortfolioId, Status);
CREATE INDEX idx_portfolio_published ON PortfolioVersions(PortfolioId, IsCurrentPublished);
```

## Frontend Components

### New Pages

1. **PortfolioManager.jsx** (`/portfolios`)
   - Dashboard for all portfolios
   - Create new portfolio modal
   - Portfolio cards with quick actions

2. **PortfolioEditor.jsx** (`/portfolio-editor/:personId`)
   - Split-pane editor with sidebar
   - Language selector
   - Version history panel
   - JSON editor with validation
   - Toolbar with actions

### Updated Components

- **App.jsx**: Added routes for new pages
- **AuthCallback.jsx**: Redirects to `/portfolios` after login
- **portfolioApi.js**: Extended with version management methods

## Deployment Steps

### 1. Backend Deployment

```powershell
# Navigate to API project
Set-Location APIs/Portfolio.Api

# Create and apply migration
dotnet ef migrations add AddPortfolioVersioning
dotnet ef database update

# Build and publish
dotnet publish -c Release
```

### 2. Frontend Deployment

```powershell
# Navigate to frontend
Set-Location portfolio-frontend

# Install dependencies (if needed)
npm install

# Build
npm run build

# Deploy dist folder to hosting
```

## Usage Workflow

### For Portfolio Owners

1. **Login**: Click "Login" button on landing page
2. **Dashboard**: View all your portfolios
3. **Edit Portfolio**: Click "Edit" on any portfolio
4. **Make Changes**:
   - Select language
   - Edit JSON content
   - Validate changes
   - Save changes
5. **Create Version**:
   - Click "Create Version"
   - Add label/description
   - Choose to stage or keep as draft
6. **Preview**:
   - Stage the version
   - Click "Preview" to open in new tab
   - Review changes
7. **Publish**:
   - When satisfied, click "Publish"
   - Version becomes live
   - Previous version is archived

### For Multiple Staged Versions

1. Create multiple versions with different changes
2. Stage all versions you want to compare
3. Preview each staged version in separate tabs
4. Compare side-by-side
5. Publish the one you prefer
6. System unstages others automatically

## Security Considerations

1. **Authentication Required**:
   - All edit operations require valid JWT token
   - Preview of staged versions requires authentication
   - Get operations for published content are public

2. **Authorization**:
   - Users can only edit portfolios they own
   - Version preview checks portfolio ownership

3. **Validation**:
   - Server-side validation prevents malformed content
   - Client-side validation provides immediate feedback

## Best Practices

1. **Regular Versioning**: Create versions for significant changes
2. **Meaningful Labels**: Use descriptive labels for versions
3. **Preview Before Publishing**: Always preview staged versions
4. **Keep History Clean**: Archive old versions periodically
5. **Test Validation**: Use validate button before saving

## Troubleshooting

### Issue: Changes Not Showing
- **Solution**: Ensure you saved changes before creating version
- Clear browser cache
- Check if you're viewing the correct version

### Issue: Validation Errors
- **Solution**: Review error messages
- Check required fields (name, tagline, email)
- Ensure JSON is properly formatted

### Issue: Preview Not Working
- **Solution**: Ensure version is staged
- Check authentication token is valid
- Verify preview URL includes versionId parameter

## Future Enhancements

1. **Diff Viewer**: Visual comparison between versions
2. **Rollback UI**: One-click rollback to previous version
3. **Bulk Operations**: Edit multiple languages at once
4. **Asset Management**: Upload and manage images/files
5. **Collaboration**: Multiple users editing same portfolio
6. **Schedule Publishing**: Set future publish dates
7. **A/B Testing**: Test different versions with real users

## Migration from Old System

If you're migrating from the old file-based locale system:

1. Create portfolios for each person (Karen, Jason)
2. Run the migration SQL script to import locale data
3. Create initial version for each portfolio
4. Publish the initial version
5. Verify portfolios display correctly
6. Begin using the new editor for future changes

## Support

For issues or questions:
- Check validation messages in the editor
- Review error logs in browser console
- Verify API responses in Network tab
- Check backend logs for server errors
