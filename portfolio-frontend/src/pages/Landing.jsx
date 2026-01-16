import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAuthConfig, getAccessToken, clearTokens } from '../services/authService';
import '../App.css';
import './Landing.css';

const Landing = () => {
  const [authUrl, setAuthUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuthAndLoadUrl = async () => {
      // Check if user is authenticated
      const token = getAccessToken();
      setIsAuthenticated(!!token);

      // Always load auth URL for the Register button
      try {
        const config = await getAuthConfig();
        
        // Store the current URL for redirect after auth
        sessionStorage.setItem('preAuthUrl', window.location.href);
        
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
    clearTokens();
    window.location.href = '/';
  };

  return (
    <div className="landing-container">
      <nav className="navbar">
        <Link to="/" className="navbar-logo">HealthDots Portfolios</Link>
        <div className="navbar-controls"></div>
        <div className="navbar-right">
          {isAuthenticated ? (
            <button className="login-button" onClick={handleLogout}>
              Logout
            </button>
          ) : authUrl ? (
            <a href={authUrl} className="login-button">
              Login
            </a>
          ) : (
            <span className="login-button" style={{ cursor: 'wait', opacity: 0.6 }}>
              Loading...
            </span>
          )}
        </div>
      </nav>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="hero-content">
            <h1>Welcome to HealthDots Portfolios</h1>
            <p className="hero-subtitle">Showcase Your Unique Story</p>
            <p className="hero-description">
              Create a beautiful, personalized portfolio site powered by HealthDots. 
              Share your projects, experiences, and passion with the world.
            </p>
            <div className="cta-buttons">
              {isAuthenticated ? (
                <>
                  <Link to="/admin" className="cta-primary">
                    Manage My Portfolios
                  </Link>
                  <button className="cta-secondary">Learn More</button>
                </>
              ) : error ? (
                <>
                  <button className="cta-primary" disabled title="Error loading auth config">Register Your Portfolio</button>
                  <button className="cta-secondary">Learn More</button>
                </>
              ) : authUrl ? (
                <>
                  <a href={authUrl} className="cta-primary">
                    Register Your Portfolio
                  </a>
                  <button className="cta-secondary">Learn More</button>
                </>
              ) : (
                <>
                  <button className="cta-primary" disabled style={{ cursor: 'wait', opacity: 0.7 }}>
                    Loading...
                  </button>
                  <button className="cta-secondary">Learn More</button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="landing-features">
          <h2>Why Choose HealthDots Portfolios?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>📱 Fully Responsive</h3>
              <p>Your portfolio looks amazing on every device, from mobile to desktop.</p>
            </div>
            <div className="feature-card">
              <h3>🌍 Multi-Language Support</h3>
              <p>Reach a global audience by presenting your work in multiple languages.</p>
            </div>
            <div className="feature-card">
              <h3>🎨 Customizable Design</h3>
              <p>Express your unique style with flexible, modern design templates.</p>
            </div>
            <div className="feature-card">
              <h3>⚡ Fast & Reliable</h3>
              <p>Built on modern technology for optimal performance and reliability.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms">Terms of Use</Link>
        </div>
        <p>&copy; 2026 HealthDots | Empower Your Portfolio</p>
      </footer>
    </div>
  );
};

export default Landing;


