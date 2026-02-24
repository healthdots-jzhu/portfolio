import { getAppLabel } from '../hooks/useAppLocale';

/**
 * Show a lightweight DOM toast message. Non-blocking and removable.
 * @param {string} text
 * @param {number} durationMs
 */
export const showToast = (text, durationMs = 3000) => {
  try {
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = 'white';
    toast.style.padding = '10px 16px';
    toast.style.borderRadius = '6px';
    toast.style.zIndex = 9999;
    toast.style.fontFamily = 'sans-serif';
    toast.style.fontSize = '14px';
    document.body.appendChild(toast);
    setTimeout(() => {
      try { document.body.removeChild(toast); } catch {}
    }, durationMs);
  } catch (e) {
    // Ignore DOM failures
    console.debug('showToast failed:', e);
  }
};

/**
 * Show a localized app-level toast by key (looks up app.messages.*)
 * @param {string} key - dot path under `app` (e.g., 'messages.sessionExpiredSigningIn')
 * @param {number} durationMs
 */
export const showToastLocalized = (key, durationMs = 3000) => {
  try {
    // Derive language from browser; fallback to 'en'
    const lang = (navigator.language || 'en').split('-')[0];
    const message = getAppLabel(key, lang) || key;
    showToast(message, durationMs);
  } catch (e) {
    console.debug('showToastLocalized failed:', e);
    showToast(key, durationMs);
  }
};

export default { showToast, showToastLocalized };
