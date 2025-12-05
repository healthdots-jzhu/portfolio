import React, { useEffect, useState, useRef } from 'react';
import { useTranslations } from '../context/LanguageContext';

const Engagements = () => {
  const { t, resolvePath } = useTranslations();
  const [expandedCards, setExpandedCards] = useState({});
  const contentRefs = useRef({});
  const [isClipped, setIsClipped] = useState({});
  // Support multiple engagements (array) while remaining backwards-compatible
  const engagementsRoot = t('engagements') || {};
  const thriftImageSrc = engagementsRoot.thriftImageSrc;
  const items = Array.isArray(engagementsRoot.items)
    ? engagementsRoot.items
    : [
        {
          pageTitle: engagementsRoot.pageTitle,
          logoSrc: engagementsRoot.logoSrc,
          logoAlt: engagementsRoot.logoAlt,
          title: engagementsRoot.title,
          taglineFirst: engagementsRoot.taglineFirst,
          taglineSecond: engagementsRoot.taglineSecond,
          cards: engagementsRoot.cards || [],
          artworkHeading: engagementsRoot.artworkHeading || engagementsRoot.merchHeading,
          artworkBody: engagementsRoot.artworkBody || engagementsRoot.merchBody,
          artworkImageSrcs: engagementsRoot.artworkImageSrcs || engagementsRoot.merchImageSrcs || [],
          artworkImageAlts: engagementsRoot.artworkImageAlts || engagementsRoot.merchImageAlts || [],
          creativePostsHeading: engagementsRoot.creativePostsHeading,
          creativePostsIntro: engagementsRoot.creativePostsIntro,
          thriftHeading: engagementsRoot.thriftHeading,
          thriftStats: engagementsRoot.thriftStats,
          thriftStatsLines: engagementsRoot.thriftStatsLines || [],
          thriftImageSrcs: engagementsRoot.thriftImageSrcs || [],
          thriftImageAlts: engagementsRoot.thriftImageAlts || [],
          leadershipHeading: engagementsRoot.leadershipHeading,
          leadershipBullets: engagementsRoot.leadershipBullets || [],
          creativeReelsHeading: engagementsRoot.creativeReelsHeading,
          creativeReelsBody: engagementsRoot.creativeReelsBody,
          // new optional showcase section
          showcaseHeading: engagementsRoot.showcaseHeading,
          showcaseSubtitle: engagementsRoot.showcaseSubtitle,
          showcaseCards: engagementsRoot.showcaseCards || [],
        },
      ];

  const toggleExpand = (cardId) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // set document title to first engagement's pageTitle (if present)
  useEffect(() => {
    const firstTitle = items[0] && items[0].pageTitle;
    if (firstTitle) document.title = firstTitle;
  }, [items]);

  // Measure whether card paragraphs are visually clipped (due to CSS clamp)
  useEffect(() => {
    const measure = () => {
      const next = {};
      items.forEach((item, itemIdx) => {
        const cards = Array.isArray(item.cards) ? item.cards : [];
        cards.forEach((card, cidx) => {
          const id = `${itemIdx}-${card.id || `card-${cidx}`}`;
          const el = contentRefs.current[id];
          if (!el) return;
          if (expandedCards[id]) {
            next[id] = false;
          } else {
            next[id] = el.scrollHeight > el.clientHeight + 1;
          }
        });
        // Also check showcase cards
        const showcaseCards = Array.isArray(item.showcaseCards) ? item.showcaseCards : [];
        showcaseCards.forEach((card, sidx) => {
          const id = `${itemIdx}-showcase-${sidx}`;
          const el = contentRefs.current[id];
          if (!el) return;
          if (expandedCards[id]) {
            next[id] = false;
          } else {
            next[id] = el.scrollHeight > el.clientHeight + 1;
          }
        });
      });
      setIsClipped(prev => ({ ...prev, ...next }));
    };

    const id = setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', measure);
    };
  }, [items, expandedCards]);

  return (
    <main className="engagements-page-wrapper">
      {items.map((item, itemIdx) => (
        <div className="engagements-page" id={`engagement-${itemIdx}`} key={itemIdx}>
          <div className="engagements-header">
            <img 
              src={resolvePath(item.logoSrc)} 
              alt={item.logoAlt}
              className="engagements-logo"
            />
            <h1>{item.title}</h1>
            <div className="engagements-tagline">
              <p>{item.taglineFirst}</p>
              <p>{item.taglineSecond}</p>
            </div>
          </div>
          <section className="engagements-cards">
            {/* Prefer locale-driven cards if provided */}
            {Array.isArray(item.cards) && item.cards.length > 0 ? (
              item.cards.map((card, cidx) => {
                const id = `${itemIdx}-${card.id || `card-${cidx}`}`;
                const title = card.title || card.heading || `Card ${cidx + 1}`;
                const logo = card.logoSrc || card.logo || '';
                const bodyLines = Array.isArray(card.bodyLines) ? card.bodyLines : (card.body ? [card.body] : []);
                const bodyHtml = bodyLines.join('<br/>');
                const expanded = !!expandedCards[id];
                const showMore = !!isClipped[id] || bodyLines.length >= 4;

                return (
                  <div className={`engagements-card ${expanded ? 'expanded' : ''}`} key={id}>
                    <div className="engagements-card-icon">
                      {logo ? (
                        <img src={resolvePath(logo)} alt={`${title} icon`} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                      ) : (
                        card.id === 'about' ? (
                          <svg viewBox="29.5 30 141 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M170.5 73.581c0-11.647-4.569-22.596-12.866-30.831-17.127-17-44.992-16.999-62.119 0L50.623 87.306a3.959 3.959 0 0 0-1.172 2.809v54.463l-18.779 18.64a3.954 3.954 0 0 0-.001 5.618A4.001 4.001 0 0 0 33.5 170a4.004 4.004 0 0 0 2.828-1.163l18.78-18.64h54.873c1.062 0 2.081-.42 2.832-1.167l26.152-26.035c.314-.233.592-.508.825-.822l17.843-17.763c8.298-8.234 12.867-19.183 12.867-30.829zm-62.179 68.672H63.112l18.598-18.46h45.154l-18.543 18.46zm43.653-43.457l-17.129 17.053h-45.13l39.722-39.426a3.954 3.954 0 0 0 .001-5.618 4.02 4.02 0 0 0-5.657-.001l-66.328 65.835V91.761l43.72-43.393c14.008-13.905 36.801-13.905 50.807 0 6.786 6.734 10.522 15.688 10.522 25.212 0 9.523-3.736 18.477-10.522 25.211l-.006.005z" fill="#504E70"/>
                          </svg>
                        ) : card.id === 'journey' ? (
                          <svg viewBox="29.5 29.5 141 141" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M166.5 96h-19.95a4 4 0 0 0 0 8h15.823c-1.985 31.281-27.092 56.37-58.373 58.358V77.06c11.308-1.91 19.95-11.767 19.95-23.61 0-13.206-10.744-23.95-23.95-23.95S76.05 40.244 76.05 53.45c0 11.843 8.642 21.7 19.95 23.61v85.298C64.719 160.37 39.612 135.281 37.627 104H53.45a4 4 0 0 0 0-8H33.5a4 4 0 0 0-4 4c0 38.874 31.626 70.5 70.5 70.5s70.5-31.626 70.5-70.5a4 4 0 0 0-4-4zM84.05 53.45c0-8.795 7.155-15.95 15.95-15.95s15.95 7.155 15.95 15.95S108.795 69.4 100 69.4s-15.95-7.155-15.95-15.95z" fill="#504E70"/>
                          </svg>
                        ) : card.id === 'impact' ? (
                          <svg viewBox="36.5 29.499 127 141.001" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M163.126 85.006a3.966 3.966 0 0 0-3.595-2.306h-55.034l6.056-48.703a4.005 4.005 0 0 0-2.355-4.166 3.947 3.947 0 0 0-4.629 1.104l-66.146 79.8a4.024 4.024 0 0 0-.549 4.259 3.966 3.966 0 0 0 3.595 2.306h55.034l-6.056 48.703a4.005 4.005 0 0 0 2.355 4.166 3.95 3.95 0 0 0 4.628-1.104l66.146-79.8a4.023 4.023 0 0 0 .55-4.259zm-64.123 68.477l4.935-39.686a4.023 4.023 0 0 0-.962-3.145 3.956 3.956 0 0 0-2.976-1.353H48.956l52.041-62.783-4.935 39.686a4.023 4.023 0 0 0 .962 3.145A3.956 3.956 0 0 0 100 90.7h51.044l-52.041 62.783z" fill="#504E70"/>
                          </svg>
                        ) : card.id === 'connect' ? (
                          <svg viewBox="29.5 29.5 141 141" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M100 29.5c-38.874 0-70.5 31.626-70.5 70.5 0 38.874 31.626 70.5 70.5 70.5s70.5-31.626 70.5-70.5c0-38.874-31.626-70.5-70.5-70.5zM162.358 96h-31.93a105.684 105.684 0 0 0-21.335-57.831C137.968 42.397 160.48 66.437 162.358 96zm-84.785 8h44.854A97.706 97.706 0 0 1 100 160.416 97.706 97.706 0 0 1 77.573 104zm0-8A97.706 97.706 0 0 1 100 39.584 97.706 97.706 0 0 1 122.427 96H77.573zm13.333-57.831A105.683 105.683 0 0 0 69.572 96h-31.93c1.878-29.563 24.39-53.603 53.264-57.831zM37.642 104h31.93a105.684 105.684 0 0 0 21.335 57.831C62.032 157.603 39.52 133.563 37.642 104zm71.452 57.831A105.692 105.692 0 0 0 130.429 104h31.93c-1.879 29.563-24.391 53.603-53.265 57.831z" fill="#504E70"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M100 29.5c-38.874 0-70.5 31.626-70.5 70.5 0 38.874 31.626 70.5 70.5 70.5s70.5-31.626 70.5-70.5c0-38.874-31.626-70.5-70.5-70.5z" fill="#504E70"/>
                          </svg>
                        )
                      )}
                    </div>
                    <h3>{title}</h3>
                    {card.isConnectCard ? (
                      <p ref={el => { contentRefs.current[id] = el; }}>
                        {card.connectInstagramLabel}:&nbsp;
                        <a href={card.connectInstagramUrl} target="_blank" rel="noopener noreferrer">
                          {card.connectInstagramHandle}
                        </a>
                        <br/>
                        <a href={card.connectWebsiteUrl} target="_blank" rel="noopener noreferrer">
                          {card.connectWebsiteLabel}
                        </a>
                      </p>
                    ) : (
                      <p ref={el => { contentRefs.current[id] = el; }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                    )}
                    {showMore && !expanded && (
                      <button className="engagements-card-expand-btn" onClick={() => toggleExpand(id)}>Show More</button>
                    )}
                    {expanded && (
                      <button className="engagements-card-expand-btn" onClick={() => toggleExpand(id)}>Show Less</button>
                    )}
                  </div>
                );
              })
            ) : null}
          </section>

          {/* Optional sections - leadership, artwork, creative posts, showcase, reels */}
          {item.leadershipHeading && (
            <section className="leadership">
              <h2>{item.leadershipHeading}</h2>
              <ul>
                {(item.leadershipBullets || []).map((bullet, bidx) => (
                  <li key={bidx}>{bullet}</li>
                ))}
              </ul>
            </section>
          )}

          {/* New optional showcase section (heading, subtitle, responsive cards) */}
          {item.showcaseHeading && (
            <section className="showcase">
              <h2>{item.showcaseHeading}</h2>
              {item.showcaseSubtitle && (
                <p className="showcase-subtitle">{item.showcaseSubtitle}</p>
              )}
              <section className="engagements-cards">
                {(item.showcaseCards || []).map((sc, sidx) => {
                  const cardId = `${itemIdx}-showcase-${sidx}`;
                  const isExpanded = expandedCards[cardId];
                  const needsExpand = isClipped[cardId];
                  return (
                    <div className={`engagements-card ${isExpanded ? 'expanded' : ''}`} key={sidx}>
                      <h3>{sc.title}</h3>
                      <p ref={(el) => (contentRefs.current[cardId] = el)}>{sc.description}</p>
                      {needsExpand && (
                        <button
                          className="engagements-card-expand-btn"
                          onClick={() => toggleExpand(cardId)}
                        >
                          {isExpanded ? 'Less' : 'More'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
            </section>
          )}

          {item.artworkHeading && (
            <section className="showcase">
              <h2>{item.artworkHeading}</h2>
              {item.artworkBody && (
                <p className="showcase-subtitle">{item.artworkBody}</p>
              )}
              <section
                className="artwork-grid"
              >
                {(item.artworkImageSrcs || []).map((src, index) => (
                  <div className="artwork-card" key={src}>
                    <img
                      src={resolvePath(src)}
                      alt={(item.artworkImageAlts || [])[index] || ''}
                    />
                  </div>
                ))}
              </section>
            </section>
          )}

          {item.creativePostsHeading && (
            <section className="creative-posts">
              <h2>{item.creativePostsHeading}</h2>
              <p>{item.creativePostsIntro}</p>
              <h3>{item.thriftHeading}</h3>
              <p>{item.thriftStats}</p>
              <div className="thrift-content">
                <div className="thrift-stats">
                  {(item.thriftStatsLines || []).map((line, idx) => {
                    const [num, ...rest] = String(line).split(' ');
                    return (
                      <h3 key={idx}>
                        <strong>{num}</strong> {rest.join(' ')}
                      </h3>
                    );
                  })}
                </div>
                <div className="thrift-image-container">
                  <div className="thrift-gallery">
                    <img
                      src={resolvePath(item.thriftImageSrc)}
                      alt={item.thriftImageAlt || ''}
                      className="thrift-card"
                    />
                  </div>
                  <a 
                    href="https://www.instagram.com/rcfashiongroup/?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw%3D%3D#" 
                    target="_blank" 
                    rel="noreferrer noopener" 
                    className="thrift-more-btn"
                    aria-label="More Posts"
                  >
                    <span>More Posts</span>
                  </a>
                </div>
              </div>
            </section>
          )}

          


          {item.creativeReelsHeading && (
            <section className="creative-reels">
              <h2>{item.creativeReelsHeading}</h2>
              <p>{item.creativeReelsBody}</p>
            </section>
          )}
        </div>
      ))}
    </main>
  );
};

export default Engagements;



