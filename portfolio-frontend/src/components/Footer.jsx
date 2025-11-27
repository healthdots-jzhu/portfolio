import React from 'react';
import { useTranslations } from '../context/LanguageContext';
import './Footer.css';

const Footer = () => {
  const { t } = useTranslations();
  return (
    <footer className="footer">
      <p>{t('common.footer')}</p>
    </footer>
  );
};

export default Footer;
