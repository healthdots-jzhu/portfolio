import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAuthConfig, getAccessToken, redirectToLogin, redirectToLogout } from '../services/authService';
import { useAppLocale } from '../hooks/useAppLocale';
import '../App.css';
import './Landing.css';

const Landing = () => {
  const [authUrl, setAuthUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const locale = useAppLocale();

  useEffect(() => {
    const checkAuthAndLoadUrl = async () => {
      // Check if user is authenticated
      const token = getAccessToken();
      setIsAuthenticated(!!token);

      // Always load auth URL for the Register button
      try {
        const config = await getAuthConfig();
        
        // Build the Cognito authorization URL
        const params = new URLSearchParams({
          client_id: config.clientId,
          response_type: 'code',
          scope: 'email openid phone',
          redirect_uri: config.redirectUri
        });
        setAuthUrl(`https://${config.domain}/oauth2/authorize?${params.toString()}`);
      } catch (err) {
        console.error('Failed to load auth config:', err);
        setError(err.message);
      }
    };

    checkAuthAndLoadUrl();
  }, []);

  const handleLogout = () => {
    redirectToLogout();
  };

  return (
    <div className="landing-container">
      <nav className="navbar">
        <Link to="/" className="navbar-logo">{locale.landing.siteTitle}</Link>
        <div className="navbar-controls"></div>
        <div className="navbar-right">
          {isAuthenticated ? (
            <button className="login-button" onClick={handleLogout}>
              {locale.nav.logout}
            </button>
          ) : authUrl ? (
            <a
              href={authUrl}
              className="login-button"
              onClick={(e) => { e.preventDefault(); redirectToLogin(); }}
            >
              {locale.nav.login}
            </a>
          ) : (
            <span className="login-button" style={{ cursor: 'wait', opacity: 0.6 }}>
              {locale.landing.loading}
            </span>
          )}
        </div>
      </nav>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="hero-content">
            <h1 data-testid="landing-hero-title">{locale.landing.heroTitle}</h1>
            <p className="hero-subtitle">{locale.landing.heroSubtitle}</p>
            <p className="hero-description">
              {locale.landing.heroDescription}
            </p>
            <div className="cta-buttons">
              {isAuthenticated ? (
                <>
                  <Link to="/portfolios" className="cta-primary" data-testid="landing-cta-primary">
                    {locale.landing.managePortfolios}
                  </Link>
                  <button className="cta-secondary">{locale.landing.learnMore}</button>
                </>
              ) : error ? (
                <>
                  <button className="cta-primary" data-testid="landing-cta-primary" disabled title="Error loading auth config">{locale.landing.registerPortfolio}</button>
                  <button className="cta-secondary">{locale.landing.learnMore}</button>
                </>
              ) : authUrl ? (
                <>
                  <a
                    href={authUrl}
                    className="cta-primary"
                    data-testid="landing-cta-primary"
                    onClick={(e) => { e.preventDefault(); redirectToLogin(); }}
                  >
                    {locale.landing.registerPortfolio}
                  </a>
                  <button className="cta-secondary">{locale.landing.learnMore}</button>
                </>
              ) : (
                <>
                  <button className="cta-primary" data-testid="landing-cta-primary" disabled style={{ cursor: 'wait', opacity: 0.7 }}>
                    {locale.landing.loading}
                  </button>
                  <button className="cta-secondary">{locale.landing.learnMore}</button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="landing-features">
          <h2>{locale.landing.featuresTitle}</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>{locale.landing.feature1Title}</h3>
              <p>{locale.landing.feature1Desc}</p>
            </div>
            <div className="feature-card">
              <h3>{locale.landing.feature2Title}</h3>
              <p>{locale.landing.feature2Desc}</p>
            </div>
            <div className="feature-card">
              <h3>{locale.landing.feature3Title}</h3>
              <p>{locale.landing.feature3Desc}</p>
            </div>
            <div className="feature-card">
              <h3>{locale.landing.feature4Title}</h3>
              <p>{locale.landing.feature4Desc}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-links">
          <Link to="/privacy" data-testid="landing-footer-privacy">{locale.landing.privacyPolicy}</Link>
          <span>•</span>
          <Link to="/terms" data-testid="landing-footer-terms">{locale.landing.termsOfUse}</Link>
        </div>
        <p>{locale.landing.copyright}</p>
      </footer>
    </div>
  );
};

export default Landing;


