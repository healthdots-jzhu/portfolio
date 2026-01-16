import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadTranslations, getAvailableLanguages } from '../locales';

const LanguageContext = createContext();

const getNestedValue = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

export const LanguageProvider = ({ children, personId }) => {
  const [language, setLanguage] = useState('en');
  const [translations, setTranslations] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState(['en']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load translations when personId or language changes
  useEffect(() => {
    let isMounted = true;

    const fetchTranslations = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (!personId) {
          console.error('No personId provided to LanguageProvider');
          setError('No portfolio specified');
          setLoading(false);
          return;
        }
        
        console.log('Loading translations for personId:', personId, 'language:', language);
        
        // Load translations and available languages in parallel
        const [translationsData, languages] = await Promise.all([
          loadTranslations(personId, language),
          getAvailableLanguages(personId)
        ]);

        if (isMounted) {
          setTranslations(translationsData);
          setAvailableLanguages(languages);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load translations:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchTranslations();

    return () => {
      isMounted = false;
    };
  }, [personId, language]);

  // If loading, show a minimal loading state
  if (loading || !translations) {
    return (
      <LanguageContext.Provider value={{
        personId: personId || '',
        language,
        availableLanguages: ['en'],
        setLanguage,
        fontFamily: 'Montserrat',
        loading: true,
        error: null,
        // During loading, suppress showing translation paths by returning empty strings
        t: () => '',
        resolvePath: (path) => path || '',
      }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  // If error and no translations, show error state
  if (error && !translations) {
    console.error('Translation loading error:', error);
  }

  const fontFamily = translations.theme?.fontFamily || 'Montserrat';

  const value = {
    personId: personId || '',
    language,
    availableLanguages,
    setLanguage,
    fontFamily,
    loading,
    error,
    t: (path) => {
      if (!path) return '';
      const result = getNestedValue(translations, path);
      // Avoid showing raw path strings when missing keys; prefer empty string fallback
      return result !== undefined ? result : '';
    },
    // Resolve paths containing {person_id} placeholder
    resolvePath: (path) => {
      if (!path || typeof path !== 'string') return path;
      return path.replace(/{person_id}/g, personId || '');
    },
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslations = () => useContext(LanguageContext);


