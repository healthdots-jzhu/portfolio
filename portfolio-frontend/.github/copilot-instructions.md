# Copilot Instructions — portfolio-frontend

These instructions apply only to the portfolio-frontend React app.

## Scope
- Focus on React + Vite + Playwright for this package.
- Ignore the designs folder; do not generate or modify design files there.
- Follow repo-wide guardrails in .github/copilot-instructions.md when applicable.

## UI/UX Rules
- Build clean, modern, and accessible UI.
- Favor clarity and content hierarchy over flashy effects.
- Use semantic HTML elements and ensure keyboard navigation works end-to-end.
- Provide visible focus states for all interactive elements.
- Use consistent spacing and typography; avoid mixing multiple size scales.
- Prefer responsive layouts using CSS grid/flex; design for mobile first and scale up.
- Avoid redundant styling; reuse existing CSS modules or create new ones as needed without inline styles.
- Avoid layout shift: reserve space for images and async content.
- Ensure color contrast meets WCAG AA where possible.
- Provide helpful empty, loading, and error states.
- Use concise microcopy; avoid jargon and ambiguous labels.
- Keep animations subtle and optional; respect reduced-motion preferences.
- Avoid inline styles unless necessary; prefer existing CSS modules or scoped styles.

## React Conventions
- Prefer functional components with hooks.
- Keep components small and focused; extract when logic or JSX grows.
- Co-locate component styles with components when appropriate.
- Use context sparingly; prefer prop drilling for simple cases.
- Keep side effects inside useEffect and clean up properly.
- Avoid unnecessary re-renders; use memoization only when justified.
- Validate props and handle null/undefined defensively in UI rendering.

## State and Data
- Keep async data states explicit: idle, loading, success, error.
- Normalize API data when needed; avoid deeply nested state mutations.
- Use the existing services layer for API calls; do not call fetch directly in components unless that pattern already exists.
- Use VITE_ environment variables for configuration; never hardcode prod URLs.

## Accessibility
- All form controls must have associated labels.
- Provide aria-labels only when visible labels are not possible.
- Ensure modals and menus trap focus and announce their role.
- For icon-only buttons, always include an accessible name.

## Testing Preferences
- Prefer Playwright for end-to-end tests under portfolio-frontend/tests/e2e.
- When adding features, add or update at least one e2e test for user-visible behavior.
- Keep tests deterministic: avoid arbitrary waits, use locators and assertions.
- Use semantic selectors or data-testid only when necessary.
- Ensure tests run with default base URL unless feature requires configuration.

## Performance
- Avoid large client-side bundles; split code where it naturally fits.
- Lazy-load heavy routes or components when appropriate.
- Minimize blocking work in render paths.

## Documentation
- Update relevant frontend docs when behavior changes: FRONTEND_INTEGRATION.md or deployment-guide.md.
- Keep instructions concise and actionable.
