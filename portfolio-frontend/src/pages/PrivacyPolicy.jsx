import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import privacyPolicyEn from '../locales/privacy-policy?raw';
import privacyPolicyFr from '../locales/privacy-policy.fr?raw';
import './LegalPage.css';

const PrivacyPolicy = () => {
  const [language, setLanguage] = useState('en');

  const content = language === 'fr' ? privacyPolicyFr : privacyPolicyEn;

  return (
    <div className="legal-page">
      <nav className="legal-navbar">
        <Link to="/" className="navbar-logo">HealthDots Portfolios</Link>
        <div className="language-selector">
          <button 
            className={language === 'en' ? 'active' : ''} 
            onClick={() => setLanguage('en')}
          >
            English
          </button>
          <button 
            className={language === 'fr' ? 'active' : ''} 
            onClick={() => setLanguage('fr')}
          >
            Français
          </button>
        </div>
      </nav>

      <main className="legal-content">
        <ReactMarkdown>{content}</ReactMarkdown>
      </main>

      <footer className="legal-footer">
        <div className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms">Terms of Use</Link>
          <span>•</span>
          <Link to="/">Home</Link>
        </div>
        <p>&copy; 2026 HealthDots Portfolios</p>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
