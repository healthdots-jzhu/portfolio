const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.healthdots.net';

let authConfig = null;
let refreshTimeoutId = null;

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

const scheduleTokenRefresh = async () => {
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }

  const token = getAccessToken();
  if (!token) return;

  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const bufferSec = 60; // refresh 60s before expiry
  const delayMs = Math.max((payload.exp - bufferSec - nowSec) * 1000, 0);

  refreshTimeoutId = setTimeout(async () => {
    try {
      await refreshAccessToken();
    } catch (e) {
      console.error('Auto refresh failed:', e);
    }
  }, delayMs);
};

/**
 * Fetch authentication configuration from the backend
 */
export const getAuthConfig = async () => {
  if (authConfig) {
    return authConfig;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/config`);
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
        const refreshExpiresDays = 30; // Typical Cognito default; adjust to your app client settings
        const refreshExpires = new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000);
        document.cookie = `refreshToken=${data.refresh_token}${domainAttr}; path=/; expires=${refreshExpires.toUTCString()}; secure; samesite=lax`;
      }
      // Schedule auto refresh based on token exp
      await scheduleTokenRefresh();
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
  
  return cookieToken || null;
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
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('accessToken='));

  return !cookieToken; // If no cookie, token is missing/expired
};

/**
 * Clear tokens from cookies
 */
export const clearTokens = () => {
  const isLocalhost = window.location.hostname === 'localhost';
  const domainAttr = isLocalhost ? '' : '; domain=.healthdots.net';
  document.cookie = `accessToken=${domainAttr}; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; samesite=lax`;
  document.cookie = `refreshToken=${domainAttr}; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; samesite=lax`;
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }
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
  await scheduleTokenRefresh();
  return data;
};

export const initTokenAutoRefresh = async () => {
  const token = getAccessToken();
  if (token) {
    await scheduleTokenRefresh();
  }
};
