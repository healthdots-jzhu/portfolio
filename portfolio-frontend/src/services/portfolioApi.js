  // ...existing code...
// API service for portfolio backend
import { maybeRefreshAccessTokenOnActivity, getAccessToken } from './authService';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_PREFIX = '/api';

// Wrapper used for all API fetches so we can trigger the on-activity refresh
// attempt before performing the request and ensure we use the freshest
// access token (either provided or read from cookie after refresh).
const apiFetch = async (url, opts = {}, providedToken) => {
  try {
    await maybeRefreshAccessTokenOnActivity();
  } catch (e) {
    // non-fatal — continue with request using whatever token we have
    console.debug('maybeRefreshAccessTokenOnActivity failed', e);
  }

  const token = providedToken || getAccessToken();
  const headers = { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  return fetch(url, { ...opts, headers });
};

class PortfolioApiService {
  /**
   * Upload an asset (image/file) to a portfolio
   * POST /api/portfolios/{personId}/assets
   */
  async uploadAsset(personId, file, token) {
    const formData = new FormData();
    formData.append('file', file);
    // Optionally add file type or other metadata
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}/assets`, {
        method: 'POST',
        body: formData,
      }, token);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to upload asset:', error);
      throw error;
    }
  }

  /**
   * Delete an asset by id for a given portfolio (personId)
   * DELETE /api/portfolios/{personId}/assets/{assetId}
   */
  async deleteAsset(personId, assetId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}/assets/${assetId}`, {
        method: 'DELETE',
      }, token);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete asset:', error);
      throw error;
    }
  }
  constructor() {
    this.cache = new Map();
    this.inFlightRequests = new Map(); // Track in-flight requests to prevent duplicates
  }

  /**
   * Fetch locale data for a specific portfolio and language
   * GET /api/portfolios/{personId}/locales/{language}
   */
  async getLocale(personId, language, options = {}) {
    const { noCache = false } = options;
    const cacheKey = `${personId}-${language}`;
    
    // Check cache first unless noCache requested
    if (!noCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const ts = noCache ? `?_ts=${Date.now()}` : '';
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}/locales/${language}${ts}` , {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(noCache ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } : {}),
        },
        cache: noCache ? 'no-store' : 'default',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Locale not found: ${personId}/${language}`);
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Get raw JSON text to preserve field order
      const data = await response.text();
      
      // Cache the result unless bypass requested
      if (!noCache) {
        this.cache.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to fetch locale ${personId}/${language}:`, error);
      throw error;
    }
  }

  /**
   * Get portfolio metadata
   * GET /api/portfolios/{personId}
   */
  async getPortfolio(personId, options = {}) {
    const { noCache = false } = options;
    const cacheKey = `portfolio-${personId}`;
    
    // Check cache first
    if (!noCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Check if request is already in flight
    if (!noCache && this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    // Create the request promise
    const requestPromise = (async () => {
      try {
        const ts = noCache ? `?_ts=${Date.now()}` : '';
        const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}${ts}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(noCache ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } : {}),
          },
          cache: noCache ? 'no-store' : 'default',
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Portfolio not found: ${personId}`);
          }
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the result unless bypass requested
        if (!noCache) {
          this.cache.set(cacheKey, data);
        }
        
        return data;
      } catch (error) {
        console.error(`Failed to fetch portfolio ${personId}:`, error);
        throw error;
      } finally {
        // Remove from in-flight requests when done (only if used)
        if (!noCache) {
          this.inFlightRequests.delete(cacheKey);
        }
      }
    })();

    // Store the in-flight request if caching enabled
    if (!noCache) {
      this.inFlightRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }

  /**
   * Get all portfolios owned by the authenticated user
   * Requires authentication
   * GET /api/portfolios
   */
  async getUserPortfolios(token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }, token);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch user portfolios:', error);
      throw error;
    }
  }

  /**
   * Get portfolio for editing by personId (authenticated)
   * Ensures the S3 folder exists for this portfolio
   * GET /api/portfolios/edit/{personId}
   */
  async getPortfolioForEdit(personId, token, options = {}) {
    const { noCache = false } = options;
    const cacheKey = `portfolio-edit-${personId}`;
    
    // Check cache first
    if (!noCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const ts = noCache ? `?_ts=${Date.now()}` : '';
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/edit/${personId}${ts}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(noCache ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } : {}),
        },
        cache: noCache ? 'no-store' : 'default',
      }, token);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 404) {
          throw new Error(`Portfolio not found: ${personId}`);
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the result unless bypass requested
      if (!noCache) {
        this.cache.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to fetch portfolio for edit ${personId}:`, error);
      throw error;
    }
  }

  /**
   * Update locale content for a portfolio
   * Requires authentication
   * PUT /api/portfolios/{personId}/locales/{language}
   */
  async updateLocale(personId, language, contentJson, token) {
    try {
      const body = { 
        // contentJson is already a JSON string from the textarea
        contentJson: typeof contentJson === 'string' ? contentJson : JSON.stringify(contentJson)
      };
      
      console.log(`updateLocale request - personId: ${personId}, language: ${language}, contentJson: ${body.contentJson}`);
      
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}/locales/${language}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, token);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        console.error('Update locale error response:', { status: response.status, statusText: response.statusText, data: errorData });
        throw new Error(`API error: ${response.status} ${response.statusText}${errorData.error ? ' - ' + errorData.error : ''}`);;
      }

      // Invalidate cache
      const cacheKey = `${personId}-${language}`;
      this.cache.delete(cacheKey);

      return await response.json();
    } catch (error) {
      console.error(`Failed to update locale ${personId}/${language}:`, error);
      throw error;
    }
  }

  /**
   * Create a new portfolio
   * Requires authentication
   * POST /api/portfolios
   */
  async createPortfolio(displayName, preferredPersonId, subdomain, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName,
          preferredPersonId,
          subdomain,
        }),
      }, token);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create portfolio:', error);
      throw error;
    }
  }

  // ============== VERSION MANAGEMENT ==============

  /**
   * Get version history for a portfolio
   * Requires authentication
   * GET /api/portfolios/{portfolioId}/versions
   */
  async getVersionHistory(portfolioId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch version history:', error);
      throw error;
    }
  }

  /**
   * Get details of a specific version
   * Requires authentication
   * GET /api/portfolios/{portfolioId}/versions/{versionId}
   */
  async getVersion(portfolioId, versionId, token) {
    const cacheKey = `version_${portfolioId}_${versionId}`;
    
    // Check for in-flight request
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }
    
    const requestPromise = (async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/${versionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }, token);

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error('Failed to fetch version:', error);
        throw error;
      } finally {
        // Remove from in-flight requests
        this.inFlightRequests.delete(cacheKey);
      }
    })();
    
    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * Create a new version (snapshot of current state)
   * Requires authentication
   * POST /api/portfolios/{portfolioId}/versions
   */
  async createVersion(portfolioId, label, changeDescription, stage, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label,
          changeDescription,
          stage,
        }),
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create version:', error);
      throw error;
    }
  }

  /**
   * Stage a version for preview
   * Requires authentication
   * POST /api/portfolios/{portfolioId}/versions/{versionId}/stage
   */
  async stageVersion(portfolioId, versionId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/${versionId}/stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to stage version:', error);
      throw error;
    }
  }

  /**
   * Unstage a version
   * Requires authentication
   * POST /api/portfolios/{portfolioId}/versions/{versionId}/unstage
   */
  async unstageVersion(portfolioId, versionId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/${versionId}/unstage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to unstage version:', error);
      throw error;
    }
  }

  /**
   * Soft delete an unpublished version (Draft or Staged)
   * Requires authentication
   * DELETE /api/portfolios/{portfolioId}/versions/{versionId}
   */
  async deleteVersion(portfolioId, versionId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/${versionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Clear caches
      this.clearCache();

      return await response.json();
    } catch (error) {
      console.error('Failed to delete version:', error);
      throw error;
    }
  }

  /**
   * Get all staged versions for preview
   * Requires authentication
   * GET /api/portfolios/{portfolioId}/versions/staged
   */
  async getStagedVersions(portfolioId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/staged`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch staged versions:', error);
      throw error;
    }
  }

  /**
   * Update version status (e.g., Draft -> Staged)
   * Requires authentication
   * PUT /api/portfolios/{portfolioId}/versions/{versionId}/status
   */
  async updateVersionStatus(versionId, status, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/versions/${versionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update version status:', error);
      throw error;
    }
  }

  /**
   * Publish a specific version (make it the current published version)
   * Requires authentication
   * POST /api/portfolios/{portfolioId}/versions/{versionId}/publish
   */
  async publishVersion(portfolioId, versionId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/${versionId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmed: true }),
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Clear caches
      this.clearCache();

      return await response.json();
    } catch (error) {
      console.error('Failed to publish version:', error);
      throw error;
    }
  }

  /**
   * Copy a version to create a new draft version
   * Requires authentication
   * POST /api/portfolios/{portfolioId}/versions/{versionId}/copy
   */
  async copyVersionToNew(portfolioId, versionId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/${versionId}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to copy version:', error);
      throw error;
    }
  }

  /**
   * Update version content (for a draft version)
   * Requires authentication
   * PUT /api/portfolios/versions/{versionId}/locales/{language}
   */
  async updateVersionContent(versionId, language, contentJson, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/versions/${versionId}/locales/${language}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentJson }),
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update version content:', error);
      throw error;
    }
  }

  /**
   * Validate locale content without saving
   * Requires authentication
   * POST /api/portfolios/{portfolioId}/versions/validate
   */
  async validateLocale(portfolioId, contentJson, language, token) {
    try {
      // Normalize empty content to empty object
      const normalizedContent = (!contentJson || contentJson.trim() === '') ? '{}' : contentJson;
      
      const requestBody = {
        contentJson: normalizedContent,
        language,
      };
      
      console.log(`validateLocale request - portfolioId: ${portfolioId}, language: ${language}, contentJson: ${normalizedContent}`);
      
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, token);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Validate locale error response:', { status: response.status, statusText: response.statusText, data: errorData });
        throw new Error(`API error: ${response.status} ${response.statusText}${errorData.error ? ' - ' + errorData.error : ''}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to validate locale:', error);
      throw error;
    }
  }

  /**
   * Get locale content for preview (specific version)
   * Requires authentication
   * GET /api/portfolios/{personId}/preview/{versionId}/locales/{language}
   */
  async getLocalePreview(personId, versionId, language, token, options = {}) {
    const { noCache = false } = options;
    try {
      const ts = noCache ? `?_ts=${Date.now()}` : '';
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}/preview/${versionId}/locales/${language}${ts}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(noCache ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } : {}),
        },
        cache: noCache ? 'no-store' : 'default',
      }, token);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Get raw JSON text to preserve field order
      return await response.text();
    } catch (error) {
      console.error(`Failed to fetch preview ${personId}/${versionId}/${language}:`, error);
      throw error;
    }
  }

  /**
   * Update a version's locale content
   * PUT /api/portfolios/{portfolioId}/versions/{versionId}/locales/{language}
   */
  async updateVersionLocale(portfolioId, versionId, language, contentJson, token) {
    try {
      const body = { contentJson };
      
      console.log(`updateVersionLocale request - portfolioId: ${portfolioId}, versionId: ${versionId}, language: ${language}, contentJson: ${body.contentJson}`);
      
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}/versions/${versionId}/locales/${language}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, token);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Update version locale error response:', { status: response.status, statusText: response.statusText, data: errorData });
        throw new Error(`API error: ${response.status} ${response.statusText}${errorData.error ? ' - ' + errorData.error : ''}`);
      }

      // Clear caches
      this.clearCache();

      return await response.json();
    } catch (error) {
      console.error('Failed to update version locale:', error);
      throw error;
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific locale
   */
  clearLocaleCache(personId, language) {
    const cacheKey = `${personId}-${language}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Soft delete a portfolio (can be restored)
   * Requires authentication
   * DELETE /api/portfolios/{portfolioId}
   */
  async deletePortfolio(portfolioId, token) {
    try {
      const response = await apiFetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${portfolioId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }, token);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      this.clearCache();
      return await response.json();
    } catch (error) {
      console.error('Failed to delete portfolio:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const portfolioApi = new PortfolioApiService();
export default portfolioApi;
