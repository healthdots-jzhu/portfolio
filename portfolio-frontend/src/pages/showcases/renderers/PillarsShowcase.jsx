import React, { useEffect, useState } from 'react';
import {
  hasCompleteDiagram,
  normalizeAnchorId,
  normalizePath,
  renderTextWithLineBreaks,
} from '../helpers';

const PillarsShowcase = ({ showcase, resolvePath, showcaseIndex }) => {
  const [activePillarBullets, setActivePillarBullets] = useState({});

  const getActiveBullet = (pillarIdx, bulletsLength) => {
    const requestedIndex = activePillarBullets[pillarIdx] || 0;
    if (bulletsLength <= 0) return -1;
    return Math.max(0, Math.min(requestedIndex, bulletsLength - 1));
  };

  useEffect(() => {
    setActivePillarBullets({});
  }, [showcaseIndex]);

  const diagramIsComplete = hasCompleteDiagram(showcase);

  return (
    <main className="showcases-page showcases-pillars-page">
      <div className="showcase-item showcase-item-pillars">
        <section className="pillars-hero">
          {showcase.preTitle && <p className="pillars-hero-pretitle">{showcase.preTitle}</p>}
          <h1 className="pillars-hero-title">{renderTextWithLineBreaks(showcase.title)}</h1>
          {showcase.subtitle && (
            <p className="pillars-hero-subtitle">{renderTextWithLineBreaks(showcase.subtitle)}</p>
          )}
          {showcase.pillarButtons?.length > 0 && (
            <div className="pillars-hero-buttons">
              {showcase.pillarButtons.map((button, buttonIndex) => (
                <a
                  key={`pillar-btn-${buttonIndex}`}
                  href={normalizePath(button.path, resolvePath)}
                  className="pillars-hero-button"
                >
                  {button.name}
                </a>
              ))}
            </div>
          )}
        </section>

        {diagramIsComplete && (
          <section className="pillars-diagram-section">
            <div className="pillars-diagram-header">
              <p className="pillars-diagram-pretitle">{showcase.diagramPreTitle}</p>
              <h2 className="pillars-diagram-title">{showcase.diagramTitle}</h2>
              <p className="pillars-diagram-subtitle">{showcase.diagramSubTitle}</p>
            </div>
            <div className="pillars-diagram-frame">
              <img
                src={resolvePath(showcase.diagramImage)}
                alt={showcase.diagramTitle || 'Diagram'}
                className="pillars-diagram-image"
              />
            </div>
          </section>
        )}

        <section className="pillars-sections">
          {(showcase.pillars || []).map((pillar, pillarIdx) => {
            const pillarAnchor = normalizeAnchorId(pillar.number, pillarIdx);
            const bullets = Array.isArray(pillar.bullets) ? pillar.bullets : [];
            const activeBulletIndex = getActiveBullet(pillarIdx, bullets.length);
            const activeBullet = activeBulletIndex >= 0 ? bullets[activeBulletIndex] : null;
            const toolItems = Array.isArray(pillar.tools)
              ? pillar.tools
              : String(pillar.tools || '')
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean);

            return (
              <article key={`pillar-${pillarIdx}`} id={pillarAnchor} className="pillar-section">
                <div className="pillar-section-header">
                  <div className="pillar-number">{pillar.number || String(pillarIdx + 1).padStart(2, '0')}</div>
                  <div className="pillar-heading-group">
                    {pillar.label && <span className="pillar-label">{pillar.label}</span>}
                    <h2 className="pillar-title">{pillar.title}</h2>
                    {pillar.subTitle && <p className="pillar-subtitle">{pillar.subTitle}</p>}
                    {pillar.description && <p className="pillar-description">{pillar.description}</p>}
                  </div>
                </div>

                {toolItems.length > 0 && (
                  <div className="pillar-tools">
                    {toolItems.map((tool, toolIdx) => (
                      <span key={`tool-${pillarIdx}-${toolIdx}`} className="pillar-tool-chip">
                        {tool}
                      </span>
                    ))}
                  </div>
                )}

                {bullets.length > 0 && (
                  <div className="pillar-bullets-grid">
                    <div className="pillar-bullet-list">
                      {bullets.map((bullet, bulletIdx) => {
                        const isActive = bulletIdx === activeBulletIndex;
                        return (
                          <button
                            type="button"
                            key={`bullet-${pillarIdx}-${bulletIdx}`}
                            className={`pillar-bullet-item ${isActive ? 'active' : ''}`}
                            onClick={() =>
                              setActivePillarBullets((prev) => ({
                                ...prev,
                                [pillarIdx]: bulletIdx,
                              }))
                            }
                          >
                            <span className="pillar-bullet-dot" />
                            <span className="pillar-bullet-title">{bullet.title}</span>
                          </button>
                        );
                      })}
                    </div>

                    {activeBullet && (
                      <div className="pillar-bullet-detail">
                        <h3>{activeBullet.title}</h3>
                        <p>{activeBullet.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {showcase.coreSkills?.rows?.length > 0 && (
          <section className="pillars-core-skills">
            <div className="pillars-core-header">
              {showcase.coreSkills.preTitle && (
                <p className="pillars-core-pretitle">{showcase.coreSkills.preTitle}</p>
              )}
              {showcase.coreSkills.title && (
                <h2 className="pillars-core-title">{showcase.coreSkills.title}</h2>
              )}
            </div>

            <div className="pillars-core-rows">
              {showcase.coreSkills.rows.map((row, rowIdx) => (
                <div key={`skills-row-${rowIdx}`} className="pillars-core-row">
                  {(Array.isArray(row) ? row : []).map((skill, skillIdx) => (
                    <span key={`skill-${rowIdx}-${skillIdx}`} className="pillars-core-skill-chip">
                      {skill}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default PillarsShowcase;
