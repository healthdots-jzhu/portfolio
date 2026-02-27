import { useState, useCallback } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useAppLocale } from '../hooks/useAppLocale';
import { COLOR_VAR_MAP, DEFAULT_COLORS } from '../utils/themeApplier';
import { applyFontFamily, FONT_REGISTRY } from '../utils/fontLoader';
import './ThemeEditorPanel.css';

/**
 * Ordered list of color token keys the user can customise.
 * Each key maps to a `theme.colors` field in the locale JSON and to
 * a `themeEditor.<key>` label in the app locale.
 */
const COLOR_TOKENS = [
  'header',
  'text',
  'muted',
  'accent',
  'accentSecondary',
  'link',
  'bg',
  'surface',
  'footer',
];

/** Font options derived from the shared registry — single source of truth. */
const FONT_OPTIONS = Object.keys(FONT_REGISTRY);

/** Returns true only for complete 3- or 6-digit hex colour strings. */
const isValidHex = (value) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);

/**
 * Parse the current theme from the locale JSON string.
 * Returns { fontFamily, colors } with sensible defaults.
 */
const parseThemeFromContent = (contentStr) => {
  try {
    const parsed = JSON.parse(contentStr || '{}');
    const colors = { ...DEFAULT_COLORS, ...(parsed.theme?.colors || {}) };
    const fontFamily = parsed.theme?.fontFamily || 'Montserrat';
    return { fontFamily, colors };
  } catch {
    return { fontFamily: 'Montserrat', colors: { ...DEFAULT_COLORS } };
  }
};

/**
 * Deep-merge updated theme values back into the JSON content string.
 */
const buildUpdatedContent = (contentStr, theme) => {
  try {
    const parsed = JSON.parse(contentStr || '{}');
    parsed.theme = {
      ...(parsed.theme || {}),
      fontFamily: theme.fontFamily,
      colors: { ...theme.colors },
    };
    return JSON.stringify(parsed, null, 2);
  } catch {
    return contentStr;
  }
};

/**
 * Preview the color token immediately in the document without saving.
 * This gives instant visual feedback inside the current tab.
 */
const previewColor = (key, value) => {
  const cssVar = COLOR_VAR_MAP[key];
  if (cssVar && value) {
    document.documentElement.style.setProperty(cssVar, value);
  }
};

const previewFont = (fontFamily) => {
  if (fontFamily) applyFontFamily(fontFamily);
};

export default function ThemeEditorPanel({ content, onApply, onClose }) {
  const locale = useAppLocale();
  const te = locale.themeEditor || {};

  const [theme, setTheme] = useState(() => parseThemeFromContent(content));
  const [activeColorKey, setActiveColorKey] = useState(null);

  const handleColorChange = useCallback((key, value) => {
    if (!isValidHex(value)) return;
    previewColor(key, value);
    setTheme((prev) => {
      const updated = { ...prev, colors: { ...prev.colors, [key]: value } };
      onApply(buildUpdatedContent(content, updated));
      return updated;
    });
  }, [content, onApply]);

  const handleFontChange = useCallback((fontFamily) => {
    previewFont(fontFamily);
    setTheme((prev) => {
      const updated = { ...prev, fontFamily };
      onApply(buildUpdatedContent(content, updated));
      return updated;
    });
  }, [content, onApply]);

  const handleReset = useCallback(() => {
    const reset = { fontFamily: 'Montserrat', colors: { ...DEFAULT_COLORS } };
    // Apply defaults immediately
    Object.entries(DEFAULT_COLORS).forEach(([k, v]) => previewColor(k, v));
    previewFont(reset.fontFamily);
    setTheme(reset);
    onApply(buildUpdatedContent(content, reset));
    setActiveColorKey(null);
  }, [content, onApply]);

  const togglePicker = (key) => {
    setActiveColorKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="theme-overlay">
      <div className="theme-modal">
        {/* Header */}
        <div className="theme-modal-header">
          <h2>{te.title}</h2>
          <button className="theme-modal-close" onClick={onClose} aria-label={te.close}>×</button>
        </div>

        <div className="theme-modal-body">
          {/* Font Section */}
          <section className="theme-section">
            <h3 className="theme-section-title">{te.fontFamily}</h3>
            <select
              className="theme-font-select"
              value={theme.fontFamily}
              onChange={(e) => handleFontChange(e.target.value)}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </section>

          {/* Colors Section */}
          <section className="theme-section">
            <h3 className="theme-section-title">{te.colors}</h3>
            <div className="theme-color-grid">
              {COLOR_TOKENS.map((key) => {
                const color = theme.colors[key] || DEFAULT_COLORS[key] || '#ffffff';
                const isActive = activeColorKey === key;
                const labelStr = te[key] || key;
                return (
                  <div key={key} className="theme-color-row">
                    <button
                      className={`theme-swatch-btn${isActive ? ' active' : ''}`}
                      style={{ background: color }}
                      onClick={() => togglePicker(key)}
                      title={labelStr}
                      aria-label={`${te.editColor}: ${labelStr}`}
                    />
                    <span className="theme-color-label">{labelStr}</span>
                    <HexColorInput
                      className="theme-hex-input"
                      color={color}
                      onChange={(v) => handleColorChange(key, v)}
                      prefixed
                    />
                    {isActive && (
                      <div className="theme-picker-popup">
                        <HexColorPicker
                          color={color}
                          onChange={(v) => handleColorChange(key, v)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Reset */}
          <div className="theme-footer-actions">
            <button className="theme-reset-btn" onClick={handleReset}>
              {te.resetDefaults}
            </button>
          </div>
        </div>
      </div>
      <div className="theme-modal-backdrop" onClick={onClose} />
    </div>
  );
}
