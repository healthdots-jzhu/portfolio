# Frontend API Integration

This document describes the updated frontend implementation that fetches locale data from the backend API instead of static JSON files.

## Overview

The frontend now uses a hybrid approach:
1. **Primary**: Fetch locale data from the backend API
2. **Fallback**: Use static JSON files if the API is unavailable

This ensures the application works during development even if the backend is not running, while taking advantage of the dynamic database content in production.

## Changes Made

### 1. API Service (`src/services/portfolioApi.js`)
- Created a new service to handle all API requests
- Implements caching to avoid redundant API calls
- Methods:
  - `getLocale(personId, language)` - Fetch locale content
  - `getPortfolio(personId)` - Get portfolio metadata with available languages
  - `getUserPortfolios(token)` - Get all portfolios owned by authenticated user
  - `updateLocale(personId, language, content, token)` - Update locale content (requires auth)
  - `clearCache()` - Clear all cached data
  - `clearLocaleCache(personId, language)` - Clear specific locale cache

### 2. Locale Loader (`src/locales/index.js`)
- Updated `loadTranslations()` to be async
- Tries API first, falls back to static files
- Updated `getAvailableLanguages()` to be async
- Fetches available languages from API or uses static registry

### 3. Language Context (`src/context/LanguageContext.jsx`)
- Refactored to handle async data loading
- Added loading and error states
- Uses `useEffect` instead of `useMemo` for translations
- Provides loading indicator while fetching data
- Maintains backward compatibility with existing components

### 4. Backend API Endpoint
Updated `PortfoliosController.GetPortfolio()` to include:
- `AvailableLanguages` - List of languages available for the portfolio

## Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
# Development
VITE_API_URL=http://localhost:5000

# Production
VITE_API_URL=https://portfolio-api.healthdots.net
```

## Testing

### Test with API (Recommended)
1. Start the backend API:
   ```bash
   cd APIs/Portfolio.Api
   dotnet run
   ```

2. Start the frontend:
   ```bash
   cd portfolio-frontend
   npm run dev
   ```

3. Open browser to `http://localhost:5173`
4. Check browser console for API loading messages

### Test with Static Files (Fallback)
1. Stop the backend API (or set wrong API URL)
2. Start the frontend:
   ```bash
   npm run dev
   ```
3. The app should still work using static JSON files
4. Check browser console for fallback messages

## API Endpoints Used

### Public Endpoints (No Auth Required)
- `GET /api/portfolios/{personId}` - Get portfolio metadata
  - Response: `{ id, personId, displayName, subdomain, createdAt, availableLanguages[] }`
  
- `GET /api/portfolios/{personId}/locales/{language}` - Get locale content
  - Response: JSON content (ContentJson field)

### Protected Endpoints (Auth Required)
- `GET /api/portfolios` - Get user's portfolios
- `PUT /api/portfolios/{personId}/locales/{language}` - Update locale content

## Loading States

The `LanguageContext` now provides:
- `loading: boolean` - True while fetching translations
- `error: string | null` - Error message if loading failed
- `translations: object | null` - The loaded translation data

Components can check these states:
```jsx
const { loading, error, t } = useTranslations();

if (loading) {
  return <div>Loading translations...</div>;
}

if (error) {
  return <div>Error loading translations: {error}</div>;
}

// Use translations normally
return <h1>{t('about.title')}</h1>;
```

## Caching Strategy

The API service implements in-memory caching:
- Each locale is cached after first load
- Cache key: `{personId}-{language}`
- Cache is cleared when locale is updated
- Cache persists for the browser session

## Next Steps

1. ✅ Frontend fetches from API
2. ⏳ Remove static locale files from git (after testing)
3. ⏳ Add authentication flow with AWS Cognito
4. ⏳ Create portfolio management dashboard
5. ⏳ Create portfolio editor with versioning
6. ⏳ Add staging/preview functionality
7. ⏳ Add publishing workflow

## Troubleshooting

### "Failed to load from API" warning
This is normal during development if the backend is not running. The app will fall back to static files.

### CORS errors
Ensure the backend API has CORS configured for your frontend origin. Check `Program.cs` in the backend.

### Missing translations
Check that:
1. The migration script ran successfully
2. The database has the locale data
3. The API endpoint returns the expected JSON structure
4. The PersonId in the URL matches the database

## Migration Verification

Test that the API returns the same data as the old static files:

1. Check Karen's English locale:
   ```
   http://localhost:5000/api/portfolios/karen-zhu-EU2O/locales/en
   ```

2. Check Jason's Chinese locale:
   ```
   http://localhost:5000/api/portfolios/jason-zhu-EU1O/locales/zh
   ```

3. Compare the API response with the corresponding JSON file in `src/locales/persons/`.
