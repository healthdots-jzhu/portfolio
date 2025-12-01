import React, { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useTranslations } from '../context/LanguageContext';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { personId } = useParams();
  const { t, language, setLanguage, availableLanguages, personId: contextPersonId } = useTranslations();

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  const navLabels = t('common.nav') || {};
  const languageLabel = t('common.languageLabel');
  const languageNames = t('common.languages');

  // Use personId from context (which handles default route) or from params
  const currentPersonId = personId || contextPersonId;

  // Get navigation items dynamically with correct paths
  const navItems = Object.keys(navLabels).map(key => {
    let path;
    if (key === 'home') {
      // Home should go to the person root
      path = currentPersonId ? `/p/${currentPersonId}` : '/';
    } else {
      // Other pages should be relative to the person route
      path = currentPersonId ? `/p/${currentPersonId}/${key}` : `/${key}`;
    }

    return {
      key,
      label: navLabels[key],
      path
    };
  });

  return (
    <nav className="navbar">
      <Link to={currentPersonId ? `/p/${currentPersonId}` : '/'} className="navbar-logo font-cursive">{t('common.siteName')}</Link>
      <div className="navbar-controls">
        <div className="language-select-wrapper">
          <select
            id="language-select"
            aria-label={languageLabel}
            className="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languageNames?.[lang] || lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
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
      <ul className={`navbar-links ${isOpen ? 'show' : ''}`}>
        {navItems.map(({ key, label, path }) => (
          <li key={key}>
            <Link to={path} onClick={closeMenu}>{label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
