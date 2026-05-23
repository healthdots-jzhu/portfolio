import { showToastLocalized } from '../utils/toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.healthdots.net';

let authConfig = null;

// How close (in seconds) to `exp` we'll allow before refreshing on activity
const ACCESS_TOKEN_REFRESH_BUFFER_SEC = 60; // refresh window
// Debounce/rate-limit settings to avoid duplicate refresh requests
const REFRESH_DEBOUNCE_MS = 1000; // 1 second
let refreshInFlight = null;
let lastRefreshAttempt = 0;

const buildRedirectUri = (config) => {
  // Prefer relative redirectPath from backend; fall back to absolute redirectUri if provided
  const path = config.redirectPath || config.redirectUri || '/auth/callback';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalizedPath}`;
};

const base64UrlDecode = (str) => {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const decoded = atob(padded);
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    const utf8 = new TextDecoder('utf-8').decode(bytes);
    return utf8;
  } catch {
    return null;
  }
};

const decodeJwt = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    if (!payloadJson) return null;
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
};

// Previously we scheduled a background timer to refresh the access token.
// New behavior: do NOT automatically re-issue tokens in the background. Instead
// expose a helper callers can invoke on user activity to refresh when within
// the configured buffer window.
export const isAccessTokenNearExpiry = () => {
  const token = getAccessToken();
  if (!token) return false;
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return (payload.exp - nowSec) <= ACCESS_TOKEN_REFRESH_BUFFER_SEC;
};

export const maybeRefreshAccessTokenOnActivity = async () => {
  if (!isAccessTokenNearExpiry()) return;

  const now = Date.now();
  // If a refresh is already in flight, await and reuse it.
  if (refreshInFlight) {
    try {
      return await refreshInFlight;
    } catch (e) {
      // fall through to allow retry
    }
  }

  // Rate-limit attempts to avoid bursts
  if (now - lastRefreshAttempt < REFRESH_DEBOUNCE_MS) return;
  lastRefreshAttempt = now;

  refreshInFlight = (async () => {
    try {
      return await refreshAccessToken();
    } finally {
      refreshInFlight = null;
    }
  })();

  try {
    return await refreshInFlight;
  } catch (e) {
    console.error('Refresh on activity failed:', e);
    throw e;
  }
};

/**
 * Fetch authentication configuration from the backend
 */
export const getAuthConfig = async () => {
  if (authConfig) {
    return authConfig;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/config`);
    if (!response.ok) {
      throw new Error('Failed to fetch auth configuration');
    }
    const rawConfig = await response.json();
    const redirectUri = buildRedirectUri(rawConfig);
    authConfig = { ...rawConfig, redirectUri };
    return authConfig;
  } catch (error) {
    console.error('Error fetching auth config:', error);
    throw error;
  }
};

/**
 * Get the Cognito token endpoint
 */
export const getCognitoTokenEndpoint = async () => {
  const config = await getAuthConfig();
  return `https://${config.domain}/oauth2/token`;
};

/**
 * Exchange authorization code directly with Cognito for tokens
 */
export const exchangeCodeForTokens = async (code) => {
  try {
    const tokenEndpoint = await getCognitoTokenEndpoint();
    const config = await getAuthConfig();
    
    // Create a simple form-encoded request to Cognito
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code: code,
      redirect_uri: config.redirectUri
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error_description || errorData.error || 'Token exchange failed';
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Store the ID token or access token in a cookie
    const token = data.id_token || data.access_token;
    if (token) {
      const expiresIn = data.expires_in || 3600;
      const expiresDate = new Date(Date.now() + expiresIn * 1000);
      
      // Set cookie - use domain for production, omit for localhost
      const isLocalhost = window.location.hostname === 'localhost';
      const domainAttr = isLocalhost ? '' : '; domain=.healthdots.net';
      document.cookie = `accessToken=${token}${domainAttr}; path=/; expires=${expiresDate.toUTCString()}; secure; samesite=lax`;
      // If refresh token is provided, store it too (Cognito returns when scope includes offline_access)
      if (data.refresh_token) {
        const refreshExpiresDays = 1; // store refresh token cookie for 1 day
        const refreshExpires = new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000);
        document.cookie = `refreshToken=${data.refresh_token}${domainAttr}; path=/; expires=${refreshExpires.toUTCString()}; secure; samesite=lax`;
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
};

/**
 * Get the current access token from cookie
 */
export const getAccessToken = () => {
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('accessToken='))
    ?.split('=')[1];

  if (!cookieToken) return null;

  // Decode and validate expiry (so expired tokens are treated as absent)
  const payload = decodeJwt(cookieToken);
  if (!payload || !payload.exp) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  // Consider token expired if past its exp time
  if (payload.exp <= nowSec) {
    // Token expired — clear it so UI updates and refresh flow can trigger
    clearTokens();
    return null;
  }

  return cookieToken;
};

const getRefreshToken = () => {
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('refreshToken='))
    ?.split('=')[1];
  return cookieToken || null;
};

/**
 * Check if token is expired
 */
export const isTokenExpired = () => {
  const token = getAccessToken();
  return !token;
};

/**
 * Clear tokens from cookies
 */
export const clearTokens = () => {
  const isLocalhost = window.location.hostname === 'localhost';
  const domainAttr = isLocalhost ? '' : '; domain=.healthdots.net';
  document.cookie = `accessToken=${domainAttr}; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; samesite=lax`;
  document.cookie = `refreshToken=${domainAttr}; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; samesite=lax`;
};

/**
 * Get authorization header for API calls
 */
export const getAuthorizationHeader = () => {
  const token = getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

export const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const tokenEndpoint = await getCognitoTokenEndpoint();
  const config = await getAuthConfig();
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!response.ok) {
    throw new Error('Refresh token exchange failed');
  }
  const data = await response.json();
  const token = data.id_token || data.access_token;
  if (token) {
    const expiresIn = data.expires_in || 3600;
    const expiresDate = new Date(Date.now() + expiresIn * 1000);
    const isLocalhost = window.location.hostname === 'localhost';
    const domainAttr = isLocalhost ? '' : '; domain=.healthdots.net';
    document.cookie = `accessToken=${token}${domainAttr}; path=/; expires=${expiresDate.toUTCString()}; secure; samesite=lax`;
  }
  return data;
};

export const initTokenAutoRefresh = async () => {
  // No background auto-refresh. Callers should invoke `maybeRefreshAccessTokenOnActivity`
  // on user interactions (clicks, navigation, etc.) to refresh when needed.
};

/**
 * Redirect the user to the identity provider (Cognito) to sign in.
 * This builds the authorize URL from the backend auth config and navigates.
 */
export const redirectToLogin = async () => {
  try {
    const config = await getAuthConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      scope: 'email openid phone',
      redirect_uri: config.redirectUri,
    });
    const authUrl = `https://${config.domain}/oauth2/authorize?${params.toString()}`;
    // Store current location to return after sign-in
    sessionStorage.setItem('preAuthUrl', window.location.href);
    // Show a localized non-blocking toast then redirect
    try {
      showToastLocalized('messages.sessionExpiredSigningIn', 3000);
      // Small delay so user can see the message
      setTimeout(() => { window.location.href = authUrl; }, 700);
    } catch (e) {
      console.debug('showToastLocalized failed:', e);
      window.location.href = authUrl;
    }
  } catch (e) {
    console.error('Failed to redirect to login:', e);
    throw e;
  }
};

/**
 * Redirect the user to Cognito Hosted UI logout endpoint to terminate the Cognito session
 * and then return the user to the app. Falls back to local-only logout if the redirect fails.
 */
export const redirectToLogout = async () => {
  try {
    const config = await getAuthConfig();
    // Destination Cognito will redirect back to after logout. Use app root by default.
    const logoutUri = window.location.origin + '/';
    const params = new URLSearchParams({
      client_id: config.clientId,
      logout_uri: logoutUri
    });

    // Clear local tokens first so UI updates immediately
    clearTokens();

    // Navigate to the Hosted UI logout which clears the Cognito session cookie
    window.location.href = `https://${config.domain}/logout?${params.toString()}`;
  } catch (err) {
    console.error('Hosted logout failed, falling back to local logout:', err);
    clearTokens();
    window.location.href = '/';
  }
};
