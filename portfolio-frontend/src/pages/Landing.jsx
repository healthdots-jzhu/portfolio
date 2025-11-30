import React from 'react';
import { Link } from 'react-router-dom';
import '../App.css';
import './Landing.css';

const Landing = () => {
  return (
    <div className="landing-container">
      <nav className="navbar">
        <Link to="/" className="navbar-logo">HealthDots Portfolios</Link>
        <div className="navbar-controls"></div>
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
              <button className="cta-primary">Register Your Portfolio</button>
              <button className="cta-secondary">Learn More</button>
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
        <p>&copy; 2024 HealthDots | Empower Your Portfolio</p>
      </footer>
    </div>
  );
};

export default Landing;
