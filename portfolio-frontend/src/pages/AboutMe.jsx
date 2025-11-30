import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';

const AboutMe = () => {
  const { t } = useTranslations();
  const pageTitle = t('home.pageTitle');
  const aboutParagraphs = t('home.aboutParagraphs') || [];
  const funFacts = t('home.funFacts') || [];

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <main className="home-page">
      <div className="home-avatar-wrapper">
        <img
          src={t('home.avatarSrc')}
          alt={t('home.avatarAlt')}
          className="home-avatar"
        />
      </div>
      <h1>{t('home.title')}</h1>
      <h2>{t('home.subtitle')}</h2>
      {aboutParagraphs.map((text, index) => (
        <p key={index}>{text}</p>
      ))}
      {funFacts.length > 0 && (
        <section className="fun-facts">
          <h3>{t('home.funFactsTitle')}</h3>
          <ul>
            {funFacts.map((fact, index) => (
              <li key={index}>{fact}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
};

export default AboutMe;
