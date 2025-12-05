import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslations } from '../context/LanguageContext';
import { parseColorTags } from '../utils/textParser';

const PersonHome = () => {
  const { t, resolvePath } = useTranslations();
  const location = useLocation();

  // Extract the base path (e.g., /p/karen-zhu-EU2O)
  const basePath = location.pathname.split('/').slice(0, 3).join('/');

  const hero = {
    title: t('common.siteName'),
    subtitle: t('home.hero.subtitle'),
    intro: t('home.hero.intro')
  };

  const features = {
    title: t('home.features.title'),
    items: t('home.features.items') || []
  };

  const topEngagements = t('home.topEngagements') || [];

  // Helper function to resolve link paths
  const resolveLink = (link) => {
    if (!link) return null;
    // If link starts with /, it's already absolute
    if (link.startsWith('/')) return link;
    // Otherwise, make it relative to the base path
    return `${basePath}/${link}`;
  };

  return (
    <main className="home-page">
      {/* Hero Section */}
      <section className="home-hero">
        <h1>{hero.title}</h1>
        <p className="home-hero-subtitle">{hero.subtitle}</p>
        <p className="home-hero-intro">{parseColorTags(hero.intro)}</p>
      </section>

      {/* Features/Interests Grid */}
      {features.items.length > 0 && (
        <section className="home-features">
          <h2>{features.title}</h2>
          <div className="home-features-grid">
            {features.items.map((item, index) => {
              const resolvedPath = resolveLink(item.path);
              return (
                <Link 
                  key={index} 
                  to={resolvedPath} 
                  className="home-feature-item"
                  aria-label={item.title}
                >
                  <img src={resolvePath(item.icon)} alt={item.title} className="home-feature-icon" />
                  <h3>{item.title}</h3>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Top Engagements */}
      {topEngagements.length > 0 && (
        <section className="home-engagements">
          {topEngagements.map((engagement, index) => {
            const resolvedPath = resolveLink(engagement.cta_path);
            return (
              <div key={index} className="home-engagement-item">
                <div className="home-engagement-content">
                  <h4>{engagement.heading}</h4>
                  <h2>{engagement.title}</h2>
                  <Link to={resolvedPath} className="home-engagement-cta">
                    {engagement.cta_label}
                  </Link>
                </div>
                <div className="home-engagement-image">
                  <img src={resolvePath(engagement.image)} alt={engagement.title} />
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
};

export default PersonHome;


