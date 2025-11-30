import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { loadTranslations, getAvailableLanguages } from '../locales';

const LanguageContext = createContext();

const getNestedValue = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

export const LanguageProvider = ({ children, personId }) => {
  const [language, setLanguage] = useState('en');

  const translations = useMemo(() => {
    if (!personId) {
      console.log('No personId provided, using default Karen translations');
      return loadTranslations('karen-zhu-EU2O', language);
    }

    console.log('Loading translations for personId:', personId, 'language:', language);
    return loadTranslations(personId, language);
  }, [personId, language]);

  const value = useMemo(() => {
    return {
      personId: personId || 'karen-zhu-EU2O', // Make current personId available
      language,
      availableLanguages: getAvailableLanguages(),
      setLanguage,
      t: (path) => {
        if (!path) return '';
        const result = getNestedValue(translations, path);
        return result !== undefined ? result : path;
      },
    };
  }, [personId, language, translations]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslations = () => useContext(LanguageContext);

