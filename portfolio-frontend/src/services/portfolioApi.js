// API service for portfolio backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_PREFIX = '/api';

class PortfolioApiService {
  constructor() {
    this.cache = new Map();
    this.inFlightRequests = new Map(); // Track in-flight requests to prevent duplicates
  }

  /**
   * Fetch locale data for a specific portfolio and language
   * GET /api/portfolios/{personId}/locales/{language}
   */
  async getLocale(personId, language) {
    const cacheKey = `${personId}-${language}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}/locales/${language}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Locale not found: ${personId}/${language}`);
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
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
  async getPortfolio(personId) {
    const cacheKey = `portfolio-${personId}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Check if request is already in flight
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    // Create the request promise
    const requestPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Portfolio not found: ${personId}`);
          }
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the result
        this.cache.set(cacheKey, data);
        
        return data;
      } catch (error) {
        console.error(`Failed to fetch portfolio ${personId}:`, error);
        throw error;
      } finally {
        // Remove from in-flight requests when done
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    // Store the in-flight request
    this.inFlightRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Get all portfolios owned by the authenticated user
   * Requires authentication
   * GET /api/portfolios
   */
  async getUserPortfolios(token) {
    try {
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/portfolios`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

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
   * Update locale content for a portfolio
   * Requires authentication
   * PUT /api/portfolios/{personId}/locales/{language}
   */
  async updateLocale(personId, language, content, token) {
    try {
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/portfolios/${personId}/locales/${language}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ contentJson: JSON.stringify(content) }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
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
}

// Export singleton instance
export const portfolioApi = new PortfolioApiService();
export default portfolioApi;
