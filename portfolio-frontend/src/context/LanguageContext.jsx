import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadTranslations, getAvailableLanguages } from '../locales';
import { applyTheme } from '../utils/themeApplier';
import useDelayedLoading from '../hooks/useDelayedLoading';
import LoadingSpinner from '../components/LoadingSpinner';

const LanguageContext = createContext();

const getNestedValue = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

export const LanguageProvider = ({ children, personId, versionId }) => {
  const COOKIE_NAME = 'portfolio_language';
  const COOKIE_MAX_DAYS = 365;

  const getCookie = (name) => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
  };

  const setCookie = (name, value, days = COOKIE_MAX_DAYS) => {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const secure = window.location && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires}; SameSite=Lax${secure}`;
  };

  const detectInitialLanguage = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 'en';
    const params = new URLSearchParams(window.location.search || '');
    const urlLang = params.get('lang') || params.get('locale');
    if (urlLang) {
      console.debug('LanguageContext.detectInitialLanguage - url search:', window.location.search, 'detected lang:', urlLang);
      return urlLang;
    }
    const cookieLang = getCookie(COOKIE_NAME);
    if (cookieLang) return cookieLang;
    return 'en';
  };

  const [language, setLanguageState] = useState(() => detectInitialLanguage());
  const [translations, setTranslations] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState(['en']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // wrapper to persist cookie when language is changed programmatically
  const setLanguage = (lang) => {
    setLanguageState(lang);
    try {
      setCookie(COOKIE_NAME, lang);
    } catch (e) {
      console.warn('Failed to set language cookie', e);
    }
  };

  // ensure cookie is synced after mount / whenever language changes
  useEffect(() => {
    try {
      setCookie(COOKIE_NAME, language);
    } catch (e) {
      // ignore
    }
  }, [language]);

  // On client mount, re-check URL `lang`/`locale` param and apply it.
  // This fixes cases where the initial render didn't pick up the query string
  // (for example during hydration or router redirects).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search || '');
      const urlLang = params.get('lang') || params.get('locale');
      if (urlLang && urlLang !== language) {
        console.debug('LanguageContext: applying URL lang override', urlLang);
        setLanguage(urlLang);
      }
    } catch (e) {
      // ignore malformed URL
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // applyTheme handles a missing/undefined theme by resetting vars to defaults,
  // which is required when switching from a themed portfolio to a theme-less one.
  useEffect(() => {
    applyTheme(translations?.theme);
  }, [translations]);

  // If loading, show a minimal loading state
  const showLoadingIndicator = useDelayedLoading(loading || !translations);
  const basePrefix = personId
    ? (versionId ? `/preview/${versionId}/${personId}` : `/p/${personId}`)
    : '';

  if (loading || !translations) {
    const fallbackValue = {
      personId: personId || '',
      versionId: versionId || null,
      basePrefix,
      language,
      availableLanguages: ['en'],
      setLanguage,
      fontFamily: 'Montserrat',
      loading: true,
      error: null,
      t: () => '',
      resolvePath: (path) => path || '',
    };

    return (
      <LanguageContext.Provider value={fallbackValue}>
        {children}
        {showLoadingIndicator && <LoadingSpinner label="Loading..." className="loading-spinner-overlay" />}
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


