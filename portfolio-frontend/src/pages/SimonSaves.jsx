import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';
import { parseColorTags } from '../utils/textParser';
import './SimonSaves.css';

const SimonSaves = () => {
  const { t, resolvePath } = useTranslations();
  
  const browserTabName = t('simonSaves.browserTabName');
  const hero = {
    title: t('simonSaves.hero.title'),
    subtitle: t('simonSaves.hero.subtitle'),
    cta_label: t('simonSaves.hero.cta_label'),
    cta_url: t('simonSaves.hero.cta_url')
  };

  const overview = {
    heading: t('simonSaves.overview.heading'),
    body: t('simonSaves.overview.body') || []
  };

  const keyFeatures = {
    title: t('simonSaves.keyFeatures.title'),
    items: t('simonSaves.keyFeatures.items') || []
  };

  const role = {
    heading: t('simonSaves.role.heading'),
    title: t('simonSaves.role.title'),
    dates: t('simonSaves.role.dates'),
    body: t('simonSaves.role.body') || []
  };

  const results = {
    heading: t('simonSaves.results.heading'),
    body: t('simonSaves.results.body') || []
  };

  const gallery = {
    mainImage: t('simonSaves.gallery.mainImage'),
    mascotImage: t('simonSaves.gallery.mascotImage')
  };

  const learnings = {
    title: t('simonSaves.learnings.title'),
    items: t('simonSaves.learnings.items') || []
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    document.title = browserTabName;
  }, [browserTabName]);

  return (
    <main className="simon-saves-page">
      {/* Hero Section */}
      <section className="simon-saves-hero">
        <h1>{hero.title}</h1>
        <p className="simon-saves-hero-subtitle">{hero.subtitle}</p>
        {hero.cta_url && (
          <a 
            href={hero.cta_url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="simon-saves-hero-cta"
            aria-label={hero.cta_label}
          >
            {hero.cta_label}
          </a>
        )}
      </section>

      {/* Overview Section */}
      {overview.body.length > 0 && (
        <section className="simon-saves-section">
          <h2>{overview.heading}</h2>
          {overview.body.map((paragraph, index) => (
            <p key={index}>{parseColorTags(paragraph)}</p>
          ))}
        </section>
      )}

      {/* Key Features Section */}
      {keyFeatures.items.length > 0 && (
        <section className="simon-saves-section simon-saves-features">
          <h2>{keyFeatures.title}</h2>
          <div className="simon-saves-features-grid">
            {keyFeatures.items.map((feature, index) => (
              <div key={index} className="simon-saves-feature-item">
                <div className="simon-saves-feature-bullet">•</div>
                <p>{feature}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My Role Section */}
      {role.body.length > 0 && (
        <section className="simon-saves-section">
          <h2>{role.heading}</h2>
          <p className="simon-saves-role-title">
            <strong>{role.title}</strong> | {role.dates}
          </p>
          {role.body.map((paragraph, index) => (
            <p key={index}>{parseColorTags(paragraph)}</p>
          ))}
        </section>
      )}

      {/* Gallery Section */}
      {(gallery.mainImage || gallery.mascotImage) && (
        <section className="simon-saves-gallery">
          <div className="simon-saves-gallery-container">
            {gallery.mainImage && (
              <div className="simon-saves-gallery-main">
                <img 
                  src={resolvePath(gallery.mainImage.src)} 
                  alt={gallery.mainImage.alt}
                  className="simon-saves-gallery-image"
                />
                {gallery.mascotImage && (
                  <div className="simon-saves-gallery-mascot-overlay">
                    <img 
                      src={resolvePath(gallery.mascotImage.src)} 
                      alt={gallery.mascotImage.alt}
                      className="simon-saves-gallery-mascot-image"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Learnings Section */}
      {learnings.items.length > 0 && (
        <section className="simon-saves-section simon-saves-learnings">
          <h2>{learnings.title}</h2>
          <ul className="simon-saves-learnings-list">
            {learnings.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Results Section */}
      {results.body.length > 0 && (
        <section className="simon-saves-section">
          <h2>{results.heading}</h2>
          {results.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      )}
    </main>
  );
};

export default SimonSaves;
