import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslations } from '../context/LanguageContext';

const Specialties = () => {
  const { t, resolvePath } = useTranslations();
  const location = useLocation();
  const pageTitle = t('specialties.pageTitle');
  const roles = t('specialties.roles') || [];

  // Extract the base path (e.g., /p/karen-zhu-EU2O)
  const basePath = location.pathname.split('/').slice(0, 3).join('/');

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  // Helper function to resolve link paths
  const resolveLink = (link) => {
    if (!link) return null;
    // If link starts with /, it's already absolute
    if (link.startsWith('/')) return link;
    // Otherwise, make it relative to the base path
    return `${basePath}/${link}`;
  };

  return (
    <main className="specialties-page">
      <h1>{t('specialties.title')}</h1>
      <section className="leadership-roles">
        <h2>{t('specialties.sectionTitle')}</h2>
        <p>{t('specialties.intro')}</p>
        {roles.map((role) => {
          const resolvedLink = resolveLink(role.link);
          return (
            <div className="role-card" key={role.title}>
              {resolvedLink ? (
                <Link to={resolvedLink}>
                  <img
                    src={resolvePath(role.imageSrc)}
                    alt={role.imageAlt}
                    className="role-card-image"
                  />
                </Link>
              ) : (
                <img
                  src={resolvePath(role.imageSrc)}
                  alt={role.imageAlt}
                  className="role-card-image"
                />
              )}
              {resolvedLink ? (
                <Link to={resolvedLink}>
                  <h3>
                    {role.title}
                  </h3>
                </Link>
              ) : (
                <h3>
                  {role.title}
                </h3>
              )}
              <p>
                {role.organization} {role.duration}
              </p>
            </div>
          );
        })}
      </section>
    </main>
  );
};

export default Specialties;


