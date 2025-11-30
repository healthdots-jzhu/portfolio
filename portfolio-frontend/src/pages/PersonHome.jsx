import React from 'react';
import { useTranslations } from '../context/LanguageContext';

const PersonHome = () => {
  const { t } = useTranslations();

  return (
    <main className="home-page" style={{ minHeight: '60vh' }}>
      {/* Blank home page with header and footer only */}
    </main>
  );
};

export default PersonHome;
