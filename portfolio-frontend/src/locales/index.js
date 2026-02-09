
import { portfolioApi } from '../services/portfolioApi';

// Async loading of person-specific translations (API only)
export const loadTranslations = async (personId, language, versionId = null) => {
  // If versionId is provided, load from version snapshot
  if (versionId) {
    const { getAccessToken } = await import('../services/authService');
    const token = await getAccessToken();
    const portfolio = await portfolioApi.getPortfolio(personId);
    if (!portfolio || !portfolio.id) {
      throw new Error('Failed to fetch portfolio ID');
    }
    const versionDetail = await portfolioApi.getVersion(portfolio.id, versionId, token);
    if (versionDetail && versionDetail.localeContent && versionDetail.localeContent[language]) {
      const content = versionDetail.localeContent[language];
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      return parsed;
    }
    return {};
  }
  // Otherwise load live content from API
  const data = await portfolioApi.getLocale(personId, language);
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  return parsed;
};

// Return available languages per person (API only)
export const getAvailableLanguages = async (personId, versionId = null) => {
  if (versionId) {
    const { getAccessToken } = await import('../services/authService');
    const token = await getAccessToken();
    const portfolio = await portfolioApi.getPortfolio(personId);
    if (!portfolio || !portfolio.id) {
      throw new Error('Failed to fetch portfolio ID');
    }
    const versionDetail = await portfolioApi.getVersion(portfolio.id, versionId, token);
    if (versionDetail && versionDetail.localeContent) {
      const versionLanguages = Object.keys(versionDetail.localeContent).filter(lang => {
        const content = versionDetail.localeContent[lang];
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        return contentStr && contentStr.trim() !== '' && contentStr !== '{}';
      });
      return versionLanguages.length > 0 ? versionLanguages : ['en'];
    }
  }
  const portfolio = await portfolioApi.getPortfolio(personId);
  if (portfolio && portfolio.availableLanguages) {
    return portfolio.availableLanguages;
  }
  return ['en'];
};

// Get available persons (API only, must be implemented in portfolioApi or elsewhere)
export const getAvailablePersons = async () => {
  // This should call an API endpoint to get available persons
  // Placeholder: return empty array or implement as needed
  return [];
};

// Check if a person exists (API only, must be implemented in portfolioApi or elsewhere)
export const personExists = async (personId) => {
  // This should call an API endpoint to check if a person exists
  // Placeholder: always return true or implement as needed
  return true;
};

