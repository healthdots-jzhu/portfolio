// Dynamic loading using Vite's import.meta.glob
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

// Synchronous loading of person-specific translations
export const loadTranslations = (personId, language) => {
  try {
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
  } catch (error) {
    console.error(`Failed to load translations for ${personId}/${language}:`, error);
    // Ultimate fallback - return first available person's English translations
    const firstPerson = Object.keys(personRegistry)[0];
    return personRegistry[firstPerson]?.en || {
      common: {
        siteName: "Portfolio Platform",
        baseTitle: "Portfolio Platform",
        nav: { about: "About" },
        footer: "Welcome to our portfolio platform"
      },
      about: {
        pageTitle: "Welcome",
        title: "Portfolio Platform",
        subtitle: "Showcase your work",
        aboutParagraphs: ["Welcome to our portfolio platform where you can showcase your work."]
      }
    };
  }
};

// Return available languages per person based on loaded locale files
export const getAvailableLanguages = (personId) => {
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

