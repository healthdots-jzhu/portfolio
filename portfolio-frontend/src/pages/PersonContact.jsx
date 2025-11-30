import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';

const PersonContact = () => {
  const { t } = useTranslations();
  const pageTitle = t('contact.pageTitle');

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <main className="contact-page">
      <h1>{t('contact.title')}</h1>
      <section className="contact-section">
        <h2>{t('contact.sectionTitle')}</h2>
        <p>{t('contact.intro')}</p>
        <div className="contact-info">
          <div className="contact-item">
            <strong>{t('contact.emailLabel')}:</strong>
            <a href={`mailto:${t('contact.email')}`}>{t('contact.email')}</a>
          </div>
          <div className="contact-item">
            <strong>{t('contact.linkedinLabel')}:</strong>
            <a href={`https://${t('contact.linkedin')}`} target="_blank" rel="noopener noreferrer">
              {t('contact.linkedin')}
            </a>
          </div>
          <div className="contact-item">
            <strong>{t('contact.githubLabel')}:</strong>
            <a href={`https://${t('contact.github')}`} target="_blank" rel="noopener noreferrer">
              {t('contact.github')}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
};

export default PersonContact;
