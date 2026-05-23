/**
 * Dynamically loads Google Fonts based on font family name
 * Maps font names to their Google Fonts API format and weights
 * Falls back to system fonts if Google Fonts API is unavailable
 */

const FONT_WEIGHTS = ':wght@400;500;600;700';
const FALLBACK_FONT_WEIGHTS = ':wght@400;700';

// Map of fonts to their Google Fonts names, weights, and fallback fonts
export const FONT_REGISTRY = {
  'Montserrat': { weights: ':wght@400;600;700', fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  'Poppins': { weights: ':wght@400;600;700', fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  'Playfair Display': { weights: ':wght@700', fallback: 'Georgia, serif' },
  'Inter': { weights: ':wght@400;500;600;700', fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  'Lato': { weights: ':wght@400;700', fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  'Open Sans': { weights: ':wght@400;600;700', fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  'Roboto': { weights: ':wght@400;500;600;700', fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  'Roboto Mono': { weights: ':wght@400;500;600;700', fallback: 'Monaco, "Courier New", monospace' },
  'DM Mono': { weights: ':wght@400;500', fallback: 'Monaco, "Courier New", monospace' },
  'Comic Neue': { weights: ':wght@400;700', fallback: 'cursive' },
  'Edu NSW ACT Cursive': { weights: '', fallback: 'cursive' },
  'Playball': { weights: '', fallback: 'cursive' },
};

/**
 * Normalize a font-family string to the primary family name.
 * Supports values like `"DM Mono", monospace` and returns `DM Mono`.
 * @param {string} fontFamily
 * @returns {string}
 */
export const normalizeFontFamilyName = (fontFamily) => {
  if (!fontFamily) return '';
  const raw = String(fontFamily).trim();
  if (!raw) return '';

  const firstFamily = raw.split(',')[0]?.trim() || '';
  return firstFamily.replace(/^['"]+|['"]+$/g, '').trim();
};

/**
 * Dynamically loads a Google Font by injecting a link tag into the document head
 * If loading fails, falls back to system fonts
 * @param {string} fontFamily - The font family name (e.g., 'Roboto', 'Comic Neue')
 */
export const loadGoogleFont = (fontFamily) => {
  if (!fontFamily) return;

  // Normalize font name
  const normalizedName = normalizeFontFamilyName(fontFamily);
  if (!normalizedName) return;
  
  // Check if font is already loaded
  if (document.querySelector(`link[data-font="${normalizedName}"]`)) {
    return;
  }

  // Get font config with fallback
  const fontConfig = FONT_REGISTRY[normalizedName] || { weights: FONT_WEIGHTS, fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };
  const weights = fontConfig.weights;
  const fallbackFont = fontConfig.fallback;
  
  // Format font name for Google Fonts API (replace spaces with +)
  const apiName = normalizedName.replace(/\s+/g, '+');
  
  // Create the Google Fonts URL
  const fontUrl = `https://fonts.googleapis.com/css2?family=${apiName}${weights}&display=swap`;
  
  // Create link tag
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontUrl;
  link.setAttribute('data-font', normalizedName);
  
  // Handle load success
  link.onload = () => {
    console.log(`Successfully loaded Google Font: ${normalizedName}`);
  };
  
  // Handle load failure - apply fallback font
  link.onerror = () => {
    console.warn(`Failed to load Google Font: ${normalizedName}. Using fallback font: ${fallbackFont}`);
    applyFallbackFont(normalizedName, fallbackFont);
  };
  
  document.head.appendChild(link);
};

/**
 * Apply a fallback font when Google Font fails to load
 * @param {string} fontFamily - The original font family name
 * @param {string} fallbackFont - The fallback font stack
 */
const applyFallbackFont = (fontFamily, fallbackFont) => {
  // Apply fallback font to CSS variable
  document.documentElement.style.setProperty('--font-primary', fallbackFont);
};

/**
 * Apply font family to CSS variable and load the font if needed
 * @param {string} fontFamily - The font family name
 */
export const applyFontFamily = (fontFamily) => {
  if (!fontFamily) return;

  // Normalize the font name
  const normalizedName = normalizeFontFamilyName(fontFamily);
  if (!normalizedName) return;
  const fontConfig = FONT_REGISTRY[normalizedName] || { weights: FONT_WEIGHTS, fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };
  
  // Set CSS variable with font name (Google Font will load in background)
  document.documentElement.style.setProperty('--font-primary', `'${normalizedName}', ${fontConfig.fallback}`);
  
  // Load the font from Google Fonts (with fallback handling)
  loadGoogleFont(normalizedName);
};
