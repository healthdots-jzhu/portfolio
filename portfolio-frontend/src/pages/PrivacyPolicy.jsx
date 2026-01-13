import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './LegalPage.css';

const PrivacyPolicy = () => {
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        let contentModule;
        if (language === 'fr') {
          contentModule = await import('../locales/privacy-policy.fr?raw');
        } else {
          contentModule = await import('../locales/privacy-policy?raw');
        }
        setContent(contentModule.default);
      } catch (error) {
        console.error('Failed to load privacy policy:', error);
        setContent('# Privacy Policy\n\nContent could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [language]);

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
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <ReactMarkdown>{content}</ReactMarkdown>
        )}
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
