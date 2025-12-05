import React, { useEffect, useState, useRef } from 'react';
import { useTranslations } from '../context/LanguageContext';
import './Cherish.css';

const Cherish = () => {
  const { t, resolvePath } = useTranslations();
  const [expandedCards, setExpandedCards] = useState({});
  const contentRefs = useRef({});
  const [isClipped, setIsClipped] = useState({});
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  
  const browserTabName = t('cherish.browserTabName');
  const hero = {
    title: t('cherish.hero.title'),
    subtitle: t('cherish.hero.subtitle'),
    cta_label: t('cherish.hero.cta_label'),
    cta_url: t('cherish.hero.cta_url')
  };

  const organization = {
    heading: t('cherish.organization.heading'),
    body: t('cherish.organization.body') || []
  };

  const role = {
    heading: t('cherish.role.heading'),
    title: t('cherish.role.title'),
    dates: t('cherish.role.dates'),
    body: t('cherish.role.body') || []
  };

  const features = {
    centerVideo: t('cherish.features.centerVideo'),
    centerVideoPoster: t('cherish.features.centerVideoPoster'),
    centerVideoAlt: t('cherish.features.centerVideoAlt'),
    leftItems: t('cherish.features.leftItems') || [],
    rightItems: t('cherish.features.rightItems') || []
  };

  const gallery = {
    leftImage: t('cherish.gallery.leftImage'),
    middleImages: t('cherish.gallery.middleImages') || [],
    rightImage: t('cherish.gallery.rightImage')
  };

  const toggleExpand = (cardId) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    document.title = browserTabName;
  }, [browserTabName]);

  // Measure whether feature card descriptions are visually clipped
  useEffect(() => {
    const measure = () => {
      const next = {};
      const allItems = [
        ...(features.leftItems || []).map((item, idx) => ({ ...item, id: `left-${idx}` })),
        ...(features.rightItems || []).map((item, idx) => ({ ...item, id: `right-${idx}` }))
      ];
      
      allItems.forEach((item) => {
        const el = contentRefs.current[item.id];
        if (!el) return;
        if (expandedCards[item.id]) {
          next[item.id] = false;
        } else {
          next[item.id] = el.scrollHeight > el.clientHeight + 1;
        }
      });
      setIsClipped(prev => ({ ...prev, ...next }));
    };

    const id = setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', measure);
    };
  }, [features, expandedCards]);

  return (
    <main className="cherish-page">
      {/* Hero Section */}
      <section className="cherish-hero">
        <h1>{hero.title}</h1>
        <p className="cherish-hero-subtitle">{hero.subtitle}</p>
        {hero.cta_url && (
          <a 
            href={hero.cta_url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="cherish-hero-cta"
            aria-label={hero.cta_label}
          >
            {hero.cta_label}
          </a>
        )}
      </section>

      {/* Features Split Layout */}
      {(features.leftItems.length > 0 || features.rightItems.length > 0 || features.centerVideo) && (
        <section className="cherish-features">
          <div className="cherish-features-grid">
            {/* Left Column */}
            <div className="cherish-features-column cherish-features-left">
              {features.leftItems.map((item, index) => {
                const id = `left-${index}`;
                const expanded = !!expandedCards[id];
                const showMore = !!isClipped[id];
                
                return (
                  <div key={index} className={`cherish-feature-item ${expanded ? 'expanded' : ''}`}>
                    <h3>{item.title}</h3>
                    <p ref={el => { contentRefs.current[id] = el; }}>{item.description}</p>
                    {showMore && !expanded && (
                      <button className="cherish-feature-expand-btn" onClick={() => toggleExpand(id)}>Show More</button>
                    )}
                    {expanded && (
                      <button className="cherish-feature-expand-btn" onClick={() => toggleExpand(id)}>Show Less</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Center Video */}
            {features.centerVideo && features.centerVideo.startsWith('/') && (
              <div className="cherish-features-column cherish-features-center">
                <div className="cherish-laptop-frame">
                  <div className="cherish-laptop-screen">
                    <video 
                      ref={videoRef}
                      className="cherish-features-video"
                      autoPlay
                      loop
                      muted
                      playsInline
                      poster={resolvePath(features.centerVideoPoster)}
                      aria-label={features.centerVideoAlt}
                    >
                      <source src={resolvePath(features.centerVideo)} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    <div className="cherish-video-controls">
                      <button 
                        className="cherish-play-pause-btn" 
                        onClick={togglePlayPause}
                        aria-label={isPlaying ? "Pause video" : "Play video"}
                      >
                        {isPlaying ? (
                          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="cherish-laptop-bottom"></div>
                  <div className="cherish-laptop-base"></div>
                </div>
              </div>
            )}

            {/* Right Column */}
            <div className="cherish-features-column cherish-features-right">
              {features.rightItems.map((item, index) => {
                const id = `right-${index}`;
                const expanded = !!expandedCards[id];
                const showMore = !!isClipped[id];
                
                return (
                  <div key={index} className={`cherish-feature-item ${expanded ? 'expanded' : ''}`}>
                    <h3>{item.title}</h3>
                    <p ref={el => { contentRefs.current[id] = el; }}>{item.description}</p>
                    {showMore && !expanded && (
                      <button className="cherish-feature-expand-btn" onClick={() => toggleExpand(id)}>Show More</button>
                    )}
                    {expanded && (
                      <button className="cherish-feature-expand-btn" onClick={() => toggleExpand(id)}>Show Less</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Organization Background */}
      {organization.body.length > 0 && (
        <section className="cherish-section">
          <h2>{organization.heading}</h2>
          {organization.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      )}

      {/* My Role */}
      {role.body.length > 0 && (
        <section className="cherish-section">
          <h2>{role.heading}</h2>
          <p className="cherish-role-title">
            <strong>{role.title}</strong> | {role.dates}
          </p>
          {role.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      )}

      {/* Gallery */}
      {(gallery.leftImage || gallery.middleImages.length > 0 || gallery.rightImage) && (
        <section className="cherish-gallery">
          <div className="cherish-gallery-grid">
            {/* Left Image */}
            {gallery.leftImage && (
              <div className="cherish-gallery-column cherish-gallery-left">
                <img 
                  src={resolvePath(gallery.leftImage.src)} 
                  alt={gallery.leftImage.alt}
                  className="cherish-gallery-image"
                />
              </div>
            )}

            {/* Middle Images */}
            {gallery.middleImages.length > 0 && (
              <div className="cherish-gallery-column cherish-gallery-middle">
                {gallery.middleImages.map((image, index) => (
                  <img 
                    key={index}
                    src={resolvePath(image.src)} 
                    alt={image.alt}
                    className="cherish-gallery-image"
                  />
                ))}
              </div>
            )}

            {/* Right Image */}
            {gallery.rightImage && (
              <div className="cherish-gallery-column cherish-gallery-right">
                <img 
                  src={resolvePath(gallery.rightImage.src)} 
                  alt={gallery.rightImage.alt}
                  className="cherish-gallery-image"
                />
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
};

export default Cherish;
