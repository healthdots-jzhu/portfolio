import React, { useEffect } from 'react';
import { useTranslations } from '../context/LanguageContext';

const PersonProjects = () => {
  const { t } = useTranslations();
  const pageTitle = t('projects.pageTitle');
  const projects = t('projects.projects') || [];

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <main className="projects-page">
      <h1>{t('projects.title')}</h1>
      <section className="projects-section">
        <h2>{t('projects.sectionTitle')}</h2>
        <p>{t('projects.intro')}</p>
        <div className="projects-grid">
          {projects.map((project, index) => (
            <div key={index} className="project-card">
              <img
                src={project.imageSrc}
                alt={project.imageAlt}
                className="project-image"
              />
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <p className="project-tech"><strong>{t('projects.technologiesLabel')}</strong> {project.technologies}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default PersonProjects;
