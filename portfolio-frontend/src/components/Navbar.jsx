import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from '../context/LanguageContext';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t, language, setLanguage, availableLanguages } = useTranslations();

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  const navLabels = t('common.nav');
  const languageLabel = t('common.languageLabel');
  const languageNames = t('common.languages');

  return (
    <nav className="navbar">
      <div className="navbar-logo">{t('common.siteName')}</div>
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
        <li><Link to="/" onClick={closeMenu}>{navLabels?.home}</Link></li>
        <li><Link to="/rcfg" onClick={closeMenu}>{navLabels?.rcfg}</Link></li>
        <li><Link to="/marketing" onClick={closeMenu}>{navLabels?.marketing}</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar;
