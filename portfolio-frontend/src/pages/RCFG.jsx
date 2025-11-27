import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';

const merchImages = [
  '/img/karen-1-1.avif',
  '/img/karen-2-1.avif',
  '/img/Untitled50_20240716182107.avif',
];

const thriftFindsImages = [
  '/img/ExecThriftFinds.avif',
  '/img/Exec Thrift Finds (1).avif',
  '/img/Exec Thrift Finds (2).avif',
  '/img/Exec Thrift Finds (3).avif',
  '/img/Exec Thrift Finds (4).avif',
  '/img/Exec Thrift Finds (5).avif',
  '/img/Exec Thrift Finds (6).avif',
  '/img/Exec Thrift Finds (7).avif',
];

const RCFG = () => {
  const { t } = useTranslations();
  const pageTitle = t('rcfg.pageTitle');
  const impactItems = t('rcfg.impactItems') || [];
  const merchImageAlts = t('rcfg.merchImageAlts') || [];
  const thriftImageAlts = t('rcfg.thriftImageAlts') || [];
  const leadershipBullets = t('rcfg.leadershipBullets') || [];

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <main className="rcfg-page">
      <h1>{t('rcfg.title')}</h1>
      <section className="about">
        <h2>{t('rcfg.aboutHeading')}</h2>
        <p>{t('rcfg.aboutBody')}</p>
      </section>
      <section className="my-journey">
        <h2>{t('rcfg.journeyHeading')}</h2>
        <p>{t('rcfg.journeyBody')}</p>
      </section>
      <section className="impact">
        <h2>{t('rcfg.impactHeading')}</h2>
        <ul>
          {impactItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="merch-design">
        <h2>{t('rcfg.merchHeading')}</h2>
        <p>{t('rcfg.merchBody')}</p>
        <div className="merch-grid">
          {merchImages.map((src, index) => (
            <img
              key={src}
              src={src}
              alt={merchImageAlts[index] || ''}
              className="merch-card"
            />
          ))}
        </div>
      </section>
      <section className="creative-posts">
        <h2>{t('rcfg.creativePostsHeading')}</h2>
        <p>{t('rcfg.creativePostsIntro')}</p>
        <h3>{t('rcfg.thriftHeading')}</h3>
        <p>{t('rcfg.thriftStats')}</p>
        <div className="thrift-gallery">
          {thriftFindsImages.map((src, index) => (
            <img
              key={src}
              src={src}
              alt={thriftImageAlts[index] || ''}
              className="thrift-card"
            />
          ))}
        </div>
      </section>
      <section className="leadership">
        <h2>{t('rcfg.leadershipHeading')}</h2>
        <ul>
          {leadershipBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </section>
      <section className="creative-reels">
        <h2>{t('rcfg.creativeReelsHeading')}</h2>
        <p>{t('rcfg.creativeReelsBody')}</p>
      </section>
      <section className="connect connect-section">
        <h2>{t('rcfg.connectHeading')}</h2>
        <p>
          {t('rcfg.connectInstagramLabel')}:&nbsp;
          <a href="https://www.instagram.com/rcfashiongroup" target="_blank" rel="noopener noreferrer">
            {t('rcfg.connectInstagramHandle')}
          </a>
        </p>
        <p>
          <a href="https://www.rcfashiongroup.com" target="_blank" rel="noopener noreferrer">
            {t('rcfg.connectWebsiteLabel')}
          </a>
        </p>
      </section>
    </main>
  );
};

export default RCFG;
