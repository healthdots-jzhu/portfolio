import { useState, useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';
import enLocale from '../locales/app/en.json';
import frLocale from '../locales/app/fr.json';
import zhLocale from '../locales/app/zh.json';

const appLocales = {
  en: enLocale,
  fr: frLocale,
  zh: zhLocale
};

/**
 * Custom hook to get app-specific UI labels and messages
 * Uses language from LanguageContext if available, otherwise defaults to provided language
 * @param {string} language - Language code ('en', 'fr', 'zh') - used as fallback
 * @returns {object} - Translation object with nested structure
 */
export const useAppLocale = (language = 'en') => {
  let contextLanguage = 'en';
  
  try {
    const { language: contextLang } = useTranslations();
    contextLanguage = contextLang || language;
  } catch {
    // LanguageContext not available, use provided language
    contextLanguage = language;
  }

  const [locale, setLocale] = useState(appLocales[contextLanguage] || appLocales.en);

  useEffect(() => {
    setLocale(appLocales[contextLanguage] || appLocales.en);
  }, [contextLanguage]);

  return locale.app || {};
};

/**
 * Get a specific translation key with dot notation
 * @param {string} key - Key path (e.g., 'portfolioManager.title')
 * @param {string} language - Language code
 * @returns {string} - Translated string or key if not found
 */
export const getAppLabel = (key, language = 'en') => {
  const locale = appLocales[language] || appLocales.en;
  const keys = key.split('.');
  let value = locale.app;

  for (const k of keys) {
    if (value[k] !== undefined) {
      value = value[k];
    } else {
      console.warn(`Missing translation key: app.${key} for language: ${language}`);
      return key;
    }
  }

  return value;
};

export default useAppLocale;
