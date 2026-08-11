import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from '../context/LanguageContext';
import { parseColorTags } from '../utils/textParser';
import './PersonHome.css';

const PersonHome = () => {
  const { t, resolvePath, basePrefix } = useTranslations();

  const hero = {
    title: t('home.hero.title'),
    subtitle: t('home.hero.subtitle'),
    intro: t('home.hero.intro'),
    eyebrow: t('home.hero.eyebrow'),
    photo: t('home.hero.photo'),
    photoAlt: t('home.hero.photoAlt'),
    ctas: Array.isArray(t('home.hero.ctas')) ? t('home.hero.ctas') : [],
  };

  const features = {
    title: t('home.features.title'),
    items: Array.isArray(t('home.features.items')) ? t('home.features.items') : []
  };

  // Optional new sections (all backward-compatible — only render when data is present)
  const statsData = t('home.stats');
  const statsItems = statsData && Array.isArray(statsData.items) ? statsData.items : [];

  const philosophyData = t('home.philosophy');
  const philosophyItems = philosophyData && Array.isArray(philosophyData.items) ? philosophyData.items : [];

  const ctaBandData = t('home.cta');
  const ctaBandButtons = ctaBandData && Array.isArray(ctaBandData.buttons) ? ctaBandData.buttons : [];

  const topEngagements = Array.isArray(t('home.topEngagements')) ? t('home.topEngagements') : [];
  const topEngagementsTitle = t('home.topEngagementsTitle');

  // Detect "executive" layout: enabled when the hero has an eyebrow or photo
  const isExecutiveLayout = !!(hero.eyebrow || hero.photo || hero.ctas.length > 0);

  const resolveLink = (link) => {
    if (!link) return null;
    if (link.startsWith('/')) return resolvePath(link);
    return `${basePrefix}/${link}`;
  };

  return (
    <main className={`home-page${isExecutiveLayout ? ' home-page--executive' : ''}`} data-testid="person-home">

      {/* ── Hero Section ── */}
      <section className={`home-hero${isExecutiveLayout ? ' home-hero--executive' : ''}`}>
        {isExecutiveLayout ? (
          /* New two-column executive hero */
          <div className="home-hero-executive-inner">
            <div className="home-hero-executive-text">
              {hero.eyebrow && (
                <span className="home-hero-eyebrow">{hero.eyebrow}</span>
              )}
              <h1 data-testid="person-hero-title">{parseColorTags(hero.title)}</h1>
              {hero.subtitle && (
                <p className="home-hero-subtitle">{hero.subtitle}</p>
              )}
              {hero.intro && (
                <p className="home-hero-intro">{parseColorTags(hero.intro)}</p>
              )}
              {hero.ctas.length > 0 && (
                <div className="home-hero-ctas">
                  {hero.ctas.map((cta, i) => {
                    const href = resolveLink(cta.path);
                    const isExternal = cta.path && (cta.path.startsWith('http://') || cta.path.startsWith('https://'));
                    const cls = `home-hero-cta${cta.primary ? ' home-hero-cta--primary' : ' home-hero-cta--ghost'}`;
                    return isExternal ? (
                      <a key={i} href={cta.path} target="_blank" rel="noopener noreferrer" className={cls}>
                        {cta.label}
                      </a>
                    ) : (
                      <Link key={i} to={href} className={cls}>{cta.label}</Link>
                    );
                  })}
                </div>
              )}
            </div>
            {hero.photo && (
              <div className="home-hero-executive-photo">
                <img
                  src={resolvePath(hero.photo)}
                  alt={hero.photoAlt || hero.title}
                  className="home-hero-photo"
                />
              </div>
            )}
          </div>
        ) : (
          /* Original centred hero */
          <>
            <h1 data-testid="person-hero-title">{hero.title}</h1>
            <p className="home-hero-subtitle">{hero.subtitle}</p>
            <p className="home-hero-intro">{parseColorTags(hero.intro)}</p>
          </>
        )}
      </section>

      {/* ── Stats Row (optional) ── */}
      {statsItems.length > 0 && (
        <section className="home-stats" aria-label="Key metrics">
          {statsItems.map((stat, i) => (
            <div key={i} className="home-stat-card">
              <span className="home-stat-value">{parseColorTags(stat.value)}</span>
              <span className="home-stat-label">{stat.label}</span>
              {stat.description && (
                <p className="home-stat-desc">{stat.description}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Philosophy / Features Section (optional new pattern) ── */}
      {philosophyItems.length > 0 && (
        <section className="home-philosophy">
          <div className="home-philosophy-head">
            {philosophyData.badge && (
              <span className="home-section-badge">{philosophyData.badge}</span>
            )}
            {philosophyData.title && (
              <h2>{parseColorTags(philosophyData.title)}</h2>
            )}
          </div>
          <div className="home-philosophy-grid">
            {philosophyItems.map((item, i) => (
              <div key={i} className="home-philosophy-card">
                {item.icon && (
                  <span className="home-philosophy-icon" aria-hidden="true">{item.icon}</span>
                )}
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Legacy Features/Interests Grid (only when philosophy is absent) ── */}
      {philosophyItems.length === 0 && features.items.length > 0 && (
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

      {/* ── Top Engagements ── */}
      {topEngagements.length > 0 && (
        <section className="home-engagements">
          {topEngagementsTitle && <h2>{topEngagementsTitle}</h2>}
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

      {/* ── CTA Band (optional) ── */}
      {ctaBandData && (ctaBandData.title || ctaBandButtons.length > 0) && (
        <section className="home-cta-band">
          {ctaBandData.title && <h2>{parseColorTags(ctaBandData.title)}</h2>}
          {ctaBandData.description && <p>{ctaBandData.description}</p>}
          {ctaBandButtons.length > 0 && (
            <div className="home-cta-band-buttons">
              {ctaBandButtons.map((btn, i) => {
                const isExternal = btn.path && (btn.path.startsWith('http://') || btn.path.startsWith('https://'));
                const cls = `home-hero-cta${btn.primary ? ' home-hero-cta--primary' : ' home-hero-cta--ghost'}`;
                return isExternal ? (
                  <a key={i} href={btn.path} target="_blank" rel="noopener noreferrer" className={cls}>
                    {btn.label}
                  </a>
                ) : (
                  <Link key={i} to={resolveLink(btn.path)} className={cls}>{btn.label}</Link>
                );
              })}
            </div>
          )}
        </section>
      )}

    </main>
  );
};

export default PersonHome;


