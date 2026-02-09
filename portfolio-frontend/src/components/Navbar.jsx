import React, { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useTranslations } from '../context/LanguageContext';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { personId } = useParams();
  const { t, language, setLanguage, availableLanguages, personId: contextPersonId, versionId } = useTranslations();

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  const rawNav = t('common.nav');
  const navConfig = Array.isArray(rawNav) ? rawNav : [];
  const languageLabel = t('common.languageLabel');
  const languageNames = t('common.languages') || {};

  // Use personId from context (which handles default route) or from params
  const currentPersonId = personId || contextPersonId;

  // Compute base prefix depending on preview/live
  const basePrefix = currentPersonId
    ? (versionId ? `/preview/${versionId}/${currentPersonId}` : `/p/${currentPersonId}`)
    : '';

  // Get navigation items dynamically with correct paths
  const navItems = navConfig.map((item, index) => {
    // If path starts with 'http://' or 'https://', use as external link
    // If path starts with '/', treat as portfolio-rooted path using basePrefix
    // Otherwise, treat as relative path under basePrefix
    let fullPath;
    if (item.path.startsWith('http://') || item.path.startsWith('https://')) {
      fullPath = item.path;
    } else if (item.path.startsWith('/')) {
      fullPath = `${basePrefix}${item.path}`;
    } else {
      fullPath = currentPersonId ? `${basePrefix}/${item.path}` : `/${item.path}`;
    }

    return {
      key: `nav-${index}`,
      label: item.label,
      path: fullPath,
      isExternal: item.path.startsWith('http://') || item.path.startsWith('https://')
    };
  });

  return (
    <nav className="navbar" data-testid="portfolio-navbar">
      <Link to={currentPersonId ? basePrefix : '/'} className="navbar-logo">{t('common.siteName')}</Link>
      <div className="navbar-controls"></div>
      <div className="navbar-right">
        <div className="language-select-wrapper">
          <select
            id="language-select"
            aria-label={languageLabel}
            className="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            data-testid="portfolio-language-select"
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languageNames?.[lang] || lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <ul className={`navbar-links ${isOpen ? 'show' : ''}`}>
          {navItems.map(({ key, label, path, isExternal }) => (
            <li key={key}>
              {isExternal ? (
                <a href={path} target="_blank" rel="noopener noreferrer" onClick={closeMenu}>{label}</a>
              ) : (
                <Link to={path} onClick={closeMenu}>{label}</Link>
              )}
            </li>
          ))}
        </ul>
        <button
          className={`hamburger ${isOpen ? 'open' : ''}`}
          onClick={toggleMenu}
          aria-label={t('common.toggleNavMenu')}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
