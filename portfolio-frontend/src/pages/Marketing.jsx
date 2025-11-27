import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';

const Marketing = () => {
  const { t } = useTranslations();
  const pageTitle = t('marketing.pageTitle');
  const roles = t('marketing.roles') || [];

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <main className="marketing-page">
      <h1>{t('marketing.title')}</h1>
      <section className="leadership-roles">
        <h2>{t('marketing.sectionTitle')}</h2>
        <p>{t('marketing.intro')}</p>
        {roles.map((role) => (
          <div className="role-card" key={role.title}>
            <img
              src={role.imageSrc}
              alt={role.imageAlt}
              className="role-card-image"
            />
            <h3>
              {role.title}
              <br />
              {role.organization} {role.duration}
            </h3>
          </div>
        ))}
      </section>
    </main>
  );
};

export default Marketing;
