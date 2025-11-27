import React, { createContext, useContext, useMemo, useState } from 'react';
import translations from '../locales';

const LanguageContext = createContext();

const getNestedValue = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  const value = useMemo(() => {
    const currentTranslations = translations[language] || translations.en;
    return {
      language,
      availableLanguages: Object.keys(translations),
      setLanguage,
      t: (path) => {
        if (!path) return '';
        const result = getNestedValue(currentTranslations, path);
        return result !== undefined ? result : path;
      },
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslations = () => useContext(LanguageContext);

