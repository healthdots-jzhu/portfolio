---
name: portfolio-frontend
description: 'Work on the React frontend in portfolio-frontend. Use when changing pages, components, routing, localization, API integration, Vite config, styles, Playwright tests, portfolio editor flows, or frontend state and UX behavior.'
argument-hint: 'Describe the frontend page, component, route, UI flow, or test behavior to work on.'
---

# Portfolio Frontend

Use this skill for frontend work in `portfolio-frontend`.

## When to Use

- Change React pages, components, hooks, context providers, or utility modules.
- Modify routing, data loading, API integration, or editor workflows.
- Update portfolio presentation pages, management pages, or localization behavior.
- Add or adjust styles, responsive behavior, or Playwright coverage.
- Debug frontend issues involving Vite, environment variables, or API-backed content loading.

## Repository Context

- App root: `portfolio-frontend`
- Source: `portfolio-frontend/src`
- Pages: `portfolio-frontend/src/pages`
- Components: `portfolio-frontend/src/components`
- Hooks: `portfolio-frontend/src/hooks`
- Services: `portfolio-frontend/src/services`
- App locale JSON: `portfolio-frontend/src/locales/app`
- E2E tests: `portfolio-frontend/tests/e2e`

## Working Rules

- Put user-facing UI text in `src/locales/app/*.json`; do not hard-code English strings in UI flows that already use app localization.
- Use shared helpers such as `useAppLocale`, `getAppLabel`, and `showToastLocalized` where applicable.
- Preserve the existing visual language unless the task explicitly asks for design changes.
- If frontend behavior depends on backend routes or payloads, verify both sides before finishing.
- Prefer existing utilities and state patterns before adding new ones.

## Procedure

1. Anchor on the page, component, hook, or service that directly controls the requested behavior.
2. Read the nearest call site or owning abstraction instead of mapping broad UI surfaces.
3. Make the smallest focused UI change.
4. Validate with the narrowest practical frontend command or test.
5. If the change depends on backend behavior, confirm the API contract still matches the frontend assumptions.

## Validation

Use the most targeted check available:

```powershell
Set-Location portfolio-frontend
npm run build
```

For end-to-end behavior:

```powershell
Set-Location portfolio-frontend
npm run test:e2e
```

For unit tests:

```powershell
Set-Location portfolio-frontend
npm run test:unit
```

## Common Checks

- Did you keep localized strings in locale JSON files?
- Did route changes stay aligned with `App.jsx` and navigation flows?
- Did API calls still match `VITE_API_URL` and the backend path shape?
- Did editor, preview, auth, or portfolio management flows regress on mobile or desktop layouts?
- If caching or async loading changed, do loading and error states still behave correctly?

## Related Docs

- `portfolio-frontend/FRONTEND_INTEGRATION.md`
- `LOCALIZATION_COMPLETE.md`
- `PORTFOLIO_MANAGEMENT_GUIDE.md`
