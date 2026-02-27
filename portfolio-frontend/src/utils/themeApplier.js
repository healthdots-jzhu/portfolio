/**
 * Applies portfolio theme tokens from the locale `theme` object to CSS custom properties.
 * Extends the font-loading pattern established in fontLoader.js.
 *
 * Default values mirror the :root definitions in index.css so that a portfolio
 * without a `theme.colors` section renders identically to before this feature
 * was introduced.
 */

/** Map from locale JSON key → CSS variable name */
export const COLOR_VAR_MAP = {
  bg:              '--color-bg',
  header:          '--color-header',
  text:            '--color-text',
  muted:           '--color-muted',
  accent:          '--color-accent',
  accentSecondary: '--color-accent-secondary',
  link:            '--color-link',
  surface:         '--color-surface',
  gray:            '--color-gray',
  footer:          '--color-footer',
};

/** Default color values – must stay in sync with :root in index.css */
export const DEFAULT_COLORS = {
  bg:              '#ffffff',
  header:          '#2d3142',
  text:            '#33374c',
  muted:           '#666666',
  accent:          '#6c63ff',
  accentSecondary: '#7fb685',
  link:            '#504e70',
  surface:         '#f8f9fa',
  gray:            '#e8e8e8',
  footer:          '#888888',
};

/**
 * Applies `theme.colors` from the locale JSON to the document's CSS variables.
 * Only sets variables for keys that are present; missing keys keep their CSS
 * default.  Call this whenever translations are loaded or changed.
 *
 * @param {object|undefined} theme – the `theme` object from the locale JSON
 */
export const applyTheme = (theme) => {
  const root = document.documentElement;

  if (!theme || !theme.colors) {
    // Reset all color vars to their defaults so switching between portfolios
    // (or clearing the theme section) doesn't bleed colours.
    Object.entries(DEFAULT_COLORS).forEach(([key, defaultValue]) => {
      const cssVar = COLOR_VAR_MAP[key];
      if (cssVar) root.style.setProperty(cssVar, defaultValue);
    });
    return;
  }

  const { colors } = theme;
  Object.entries(COLOR_VAR_MAP).forEach(([key, cssVar]) => {
    const value = colors[key];
    if (value && typeof value === 'string' && value.trim()) {
      root.style.setProperty(cssVar, value.trim());
    } else if (DEFAULT_COLORS[key]) {
      // Ensure missing keys fall back to the designed default rather than
      // whatever the previous portfolio may have set.
      root.style.setProperty(cssVar, DEFAULT_COLORS[key]);
    }
  });
};
