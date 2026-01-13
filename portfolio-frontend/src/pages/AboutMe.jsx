import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';
import './AboutMe.css';

const AboutMe = () => {
  const { t, resolvePath } = useTranslations();
  const pageTitle = t('about.pageTitle');
  const aboutParagraphs = t('about.aboutParagraphs') || [];
  const funFacts = t('about.funFacts') || [];
  const hobbiesImageSrc = t('about.hobbiesImageSrc');

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <main className="home-page about-page">
      <div className="about-section">
        <div className="about-image">
          <img
            src={resolvePath(t('about.avatarSrc'))}
            alt={t('about.avatarAlt')}
            className="about-avatar"
          />
        </div>
        <div className="about-content">
          <h2>{t('about.subtitle')}</h2>
          {aboutParagraphs.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      </div>

      {funFacts.length > 0 && (
        <section className="fun-facts-section">
          <div className="fun-facts-image">
            <img
              src={resolvePath(hobbiesImageSrc)}
              alt="Hobbies and fun facts"
              className="hobbies-image"
            />
          </div>
          <div className="fun-facts-content">
            <h3>{t('about.funFactsTitle')}</h3>
            <ul>
              {funFacts.map((fact, index) => (
                <li key={index}>{fact}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
};

export default AboutMe;


