import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadTranslations, getAvailableLanguages } from '../locales';
import { applyTheme } from '../utils/themeApplier';

const LanguageContext = createContext();

const getNestedValue = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

export const LanguageProvider = ({ children, personId, versionId }) => {
  const [language, setLanguage] = useState('en');
  const [translations, setTranslations] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState(['en']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load translations when personId, versionId, or language changes
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
        
        console.log('Loading translations for personId:', personId, 'versionId:', versionId, 'language:', language);
        
        // Load translations and available languages in parallel
        const [translationsData, languages] = await Promise.all([
          loadTranslations(personId, language, versionId),
          getAvailableLanguages(personId, versionId)
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
  }, [personId, language, versionId]);

  // Apply color theme tokens whenever translations change.
  // Placed before any conditional returns so hook order is always stable.
  // Guard inside the effect body handles the null/loading case.
  useEffect(() => {
    if (translations?.theme) {
      applyTheme(translations.theme);
    }
  }, [translations]);

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

  const basePrefix = personId
    ? (versionId ? `/preview/${versionId}/${personId}` : `/p/${personId}`)
    : '';

  const value = {
    personId: personId || '',
    versionId: versionId || null,
    basePrefix,
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
    // Resolve paths containing {person_id} placeholder and prefix with the correct base when needed
    resolvePath: (path) => {
      if (!path || typeof path !== 'string') return path;
      const replaced = path.replace(/{person_id}/g, personId || '');
      // Don't prefix external URLs
      if (replaced.startsWith('http://') || replaced.startsWith('https://')) {
        return replaced;
      }
      // Prefix image paths with CDN URL
      if (replaced.startsWith('/img/')) {
        const cdnUrl = import.meta.env.VITE_CDN_URL || '';
        return cdnUrl ? `${cdnUrl}${replaced}` : replaced;
      }
      // Don't prefix other static asset paths (served by frontend)
      if (replaced.startsWith('/assets/') || replaced.startsWith('/fonts/')) {
        return replaced;
      }
      // Prefix portfolio-relative navigation paths (like /specialties, /projects, etc.)
      if (replaced.startsWith('/')) {
        return `${basePrefix}${replaced}`;
      }
      return replaced;
    },
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslations = () => useContext(LanguageContext);


