import React, { useEffect, useRef, useState } from 'react';
import { renderTextWithLineBreaks } from '../helpers';

const CarouselShowcase = ({ showcase, resolvePath }) => {
  const [expandedCards, setExpandedCards] = useState({});
  const [carouselIndices, setCarouselIndices] = useState({});
  const contentRefs = useRef({});
  const [isClipped, setIsClipped] = useState({});

  const toggleExpand = (cardId) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const handleCarouselPrev = () => {
    setCarouselIndices((prev) => {
      const currentIndex = prev[showcase.title] || 0;
      const newIndex = (currentIndex - 1 + showcase.carouselImages.length) % showcase.carouselImages.length;
      return { ...prev, [showcase.title]: newIndex };
    });
  };

  const handleCarouselNext = () => {
    setCarouselIndices((prev) => {
      const currentIndex = prev[showcase.title] || 0;
      const newIndex = (currentIndex + 1) % showcase.carouselImages.length;
      return { ...prev, [showcase.title]: newIndex };
    });
  };

  const carouselIndex = carouselIndices[showcase.title] || 0;
  const currentImage = showcase.carouselImages?.[carouselIndex];

  useEffect(() => {
    const measure = () => {
      const next = {};
      (showcase.features || []).forEach((feature, idx) => {
        const id = `${showcase.title}-feature-${idx}`;
        const el = contentRefs.current[id];
        if (!el) return;
        if (expandedCards[id]) {
          next[id] = false;
        } else {
          next[id] = el.scrollHeight > el.clientHeight + 1;
        }
      });
      setIsClipped((prev) => ({ ...prev, ...next }));
    };

    const id = setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', measure);
    };
  }, [showcase, expandedCards]);

  return (
    <main className="showcases-page">
      <div className="showcase-item">
        <section className="showcase-hero">
          {showcase.preTitle && <p className="showcase-hero-pretitle">{showcase.preTitle}</p>}
          <h1>{renderTextWithLineBreaks(showcase.title)}</h1>
          <p className="showcase-hero-subtitle">{renderTextWithLineBreaks(showcase.subtitle)}</p>
          {showcase.cta_url && (
            <a
              href={showcase.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="showcase-hero-cta"
              aria-label={showcase.cta_label}
            >
              {showcase.cta_label}
            </a>
          )}
        </section>

        {((showcase.features && showcase.features.length > 0) ||
          (showcase.carouselImages && showcase.carouselImages.length > 0)) && (
          <section className="showcase-features">
            <div className="showcase-features-grid">
              <div className="showcase-features-column showcase-features-left">
                {showcase.features && showcase.features.slice(0, Math.ceil(showcase.features.length / 2)).map((feature, featureIndex) => {
                  const id = `${showcase.title}-feature-${featureIndex}`;
                  const expanded = !!expandedCards[id];
                  const showMore = !!isClipped[id];

                  return (
                    <div key={featureIndex} className={`showcase-feature-item ${expanded ? 'expanded' : ''}`}>
                      <h3>{feature.title}</h3>
                      <p
                        ref={(el) => {
                          contentRefs.current[id] = el;
                        }}
                      >
                        {feature.description}
                      </p>
                      {showMore && !expanded && (
                        <button
                          type="button"
                          className="showcase-feature-expand-btn"
                          onClick={() => toggleExpand(id)}
                        >
                          Show More
                        </button>
                      )}
                      {expanded && (
                        <button
                          type="button"
                          className="showcase-feature-expand-btn"
                          onClick={() => toggleExpand(id)}
                        >
                          Show Less
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {showcase.carouselImages && showcase.carouselImages.length > 0 && (
                <div className="showcase-features-column showcase-features-center">
                  <div className="showcase-carousel">
                    <button
                      type="button"
                      className="showcase-carousel-btn showcase-carousel-prev"
                      onClick={handleCarouselPrev}
                      aria-label="Previous image"
                    >
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>

                    <div className="showcase-carousel-track">
                      {currentImage && (
                        <img
                          src={resolvePath(currentImage.imageSrc)}
                          alt={currentImage.imageAlt}
                          className="showcase-carousel-image"
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      className="showcase-carousel-btn showcase-carousel-next"
                      onClick={handleCarouselNext}
                      aria-label="Next image"
                    >
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>

                    {showcase.carouselImages.length > 1 && (
                      <div className="showcase-carousel-indicators">
                        {showcase.carouselImages.map((_, index) => (
                          <button
                            type="button"
                            key={index}
                            className={`showcase-carousel-indicator ${index === carouselIndex ? 'active' : ''}`}
                            onClick={() =>
                              setCarouselIndices((prev) => ({
                                ...prev,
                                [showcase.title]: index,
                              }))
                            }
                            aria-label={`Go to image ${index + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="showcase-features-column showcase-features-right">
                {showcase.features && showcase.features.slice(Math.ceil(showcase.features.length / 2)).map((feature, idx) => {
                  const featureIndex = Math.ceil(showcase.features.length / 2) + idx;
                  const id = `${showcase.title}-feature-${featureIndex}`;
                  const expanded = !!expandedCards[id];
                  const showMore = !!isClipped[id];

                  return (
                    <div key={featureIndex} className={`showcase-feature-item ${expanded ? 'expanded' : ''}`}>
                      <h3>{feature.title}</h3>
                      <p
                        ref={(el) => {
                          contentRefs.current[id] = el;
                        }}
                      >
                        {feature.description}
                      </p>
                      {showMore && !expanded && (
                        <button
                          type="button"
                          className="showcase-feature-expand-btn"
                          onClick={() => toggleExpand(id)}
                        >
                          Show More
                        </button>
                      )}
                      {expanded && (
                        <button
                          type="button"
                          className="showcase-feature-expand-btn"
                          onClick={() => toggleExpand(id)}
                        >
                          Show Less
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {showcase.stories && showcase.stories.length > 0 && (
          <section className="showcase-stories">
            {showcase.stories.map((story, storyIndex) => (
              <div key={storyIndex} className="showcase-story">
                <h2>{story.title}</h2>
                {story.subtitle && <p className="showcase-story-subtitle">{story.subtitle}</p>}

                {story.description && (
                  <div className="showcase-story-description">
                    <p>{story.description}</p>
                  </div>
                )}

                {story.images && story.images.length > 0 && (
                  <div className="showcase-story-images">
                    {story.images.map((image, imgIndex) => (
                      <img
                        key={imgIndex}
                        src={resolvePath(image.imageSrc)}
                        alt={image.imageAlt}
                        className="showcase-story-image"
                        title={image.imageAlt}
                      />
                    ))}
                  </div>
                )}

                {story.footer && (
                  <div className="showcase-story-footer">
                    <p>{story.footer}</p>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
};

export default CarouselShowcase;
