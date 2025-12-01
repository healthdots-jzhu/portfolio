import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';

const AboutMe = () => {
  const { t } = useTranslations();
  const pageTitle = t('about.pageTitle');
  const aboutParagraphs = t('about.aboutParagraphs') || [];
  const funFacts = t('about.funFacts') || [];

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <main className="home-page">
      <div className="home-avatar-wrapper">
        <img
          src={t('about.avatarSrc')}
          alt={t('about.avatarAlt')}
          className="home-avatar"
        />
      </div>
      <h1>{t('about.title')}</h1>
      <h2>{t('about.subtitle')}</h2>
      {aboutParagraphs.map((text, index) => (
        <p key={index}>{text}</p>
      ))}
      {funFacts.length > 0 && (
        <section className="fun-facts">
          <h3>{t('about.funFactsTitle')}</h3>
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


