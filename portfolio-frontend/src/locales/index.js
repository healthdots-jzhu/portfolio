import { portfolioApi } from '../services/portfolioApi';

// Dynamic loading using Vite's import.meta.glob (for fallback)
const personModules = import.meta.glob('./persons/*/en.json', { eager: true });
const personModulesFr = import.meta.glob('./persons/*/fr.json', { eager: true });
const personModulesZh = import.meta.glob('./persons/*/zh.json', { eager: true });

// Build dynamic registry from scanned files
const personRegistry = {};

Object.keys(personModules).forEach(path => {
  const match = path.match(/\.\/persons\/([^\/]+)\/en\.json/);
  if (match) {
    const personId = match[1];
    personRegistry[personId] = {
      en: personModules[path].default,
      fr: personModulesFr[path.replace('en.json', 'fr.json')]?.default,
      zh: personModulesZh[path.replace('en.json', 'zh.json')]?.default
    };
  }
});

console.log('Available person portfolios:', Object.keys(personRegistry));

// Async loading of person-specific translations (API first, fallback to static)
export const loadTranslations = async (personId, language, versionId = null) => {
  try {
    // If versionId is provided, load from version snapshot
    if (versionId) {
      const { getAccessToken } = await import('../services/authService');
      const token = await getAccessToken();
      
      // First fetch portfolio to get the portfolio ID
      const portfolio = await portfolioApi.getPortfolio(personId);
      if (!portfolio || !portfolio.id) {
        throw new Error('Failed to fetch portfolio ID');
      }
      
      const versionDetail = await portfolioApi.getVersion(portfolio.id, versionId, token);
      if (versionDetail && versionDetail.localeContent && versionDetail.localeContent[language]) {
        console.log(`Loaded ${personId}/version${versionId}/${language} from version snapshot`);
        const content = versionDetail.localeContent[language];
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        return parsed;
      }
      // If language doesn't exist in version, return empty object
      console.log(`Language ${language} not found in version ${versionId}, returning empty object`);
      return {};
    }
    
    // Otherwise load live content from API
    const data = await portfolioApi.getLocale(personId, language);
    console.log(`Loaded ${personId}/${language} from API`);
    
    // Parse the JSON string if it's a string (from the API)
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return parsed;
  } catch (apiError) {
    console.warn(`Failed to load from API, falling back to static files:`, apiError.message);
    
    // Fallback to static files
    const personConfig = personRegistry[personId];
    if (!personConfig) {
      console.warn(`Person ${personId} not found, available persons:`, Object.keys(personRegistry));
      // Use the first available person as fallback
      const fallbackPersonId = Object.keys(personRegistry)[0] || 'karen-zhu-EU2O';
      return loadTranslations(fallbackPersonId, language);
    }

    const translations = personConfig[language];
    if (!translations) {
      console.warn(`Language ${language} not available for person ${personId}, using English fallback`);
      return personConfig['en'] || personRegistry[Object.keys(personRegistry)[0]]?.en;
    }

    return translations;
  }
};

// Return available languages per person (API first, fallback to static)
export const getAvailableLanguages = async (personId, versionId = null) => {
  try {
    // If versionId is provided, get languages from version snapshot
    if (versionId) {
      const { getAccessToken } = await import('../services/authService');
      const token = await getAccessToken();
      
      // First fetch portfolio to get the portfolio ID
      const portfolio = await portfolioApi.getPortfolio(personId);
      if (!portfolio || !portfolio.id) {
        throw new Error('Failed to fetch portfolio ID');
      }
      
      const versionDetail = await portfolioApi.getVersion(portfolio.id, versionId, token);
      if (versionDetail && versionDetail.localeContent) {
        // Get languages from snapshot, excluding empty ones
        const versionLanguages = Object.keys(versionDetail.localeContent).filter(lang => {
          const content = versionDetail.localeContent[lang];
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          return contentStr && contentStr.trim() !== '' && contentStr !== '{}';
        });
        return versionLanguages.length > 0 ? versionLanguages : ['en'];
      }
    }
    
    // Otherwise get from live portfolio
    const portfolio = await portfolioApi.getPortfolio(personId);
    if (portfolio && portfolio.availableLanguages) {
      return portfolio.availableLanguages;
    }
  } catch (error) {
    console.warn(`Failed to get languages from API, using static registry:`, error.message);
  }
  
  // Fallback to static registry
  const config = personRegistry[personId];
  const langs = [];
  if (config?.en) langs.push('en');
  if (config?.fr) langs.push('fr');
  if (config?.zh) langs.push('zh');
  // Fallback to English if nothing found
  return langs.length ? langs : ['en'];
};

export const getAvailablePersons = () => Object.keys(personRegistry);

// Check if a person exists
export const personExists = (personId) => {
  return personRegistry.hasOwnProperty(personId);
};

// Legacy export for backward compatibility (not used in new structure)
const firstPerson = Object.keys(personRegistry)[0];
const en = personRegistry[firstPerson]?.en;
const fr = personRegistry[firstPerson]?.fr;
const zh = personRegistry[firstPerson]?.zh;

const translations = {
  en,
  fr,
  zh,
};

export default translations;

