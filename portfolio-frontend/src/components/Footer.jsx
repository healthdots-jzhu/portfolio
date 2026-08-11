import React from 'react';
import { useTranslations } from '../context/LanguageContext';
import './Footer.css';

const Footer = () => {
  const { t } = useTranslations();

  // New rich footer: opt-in when locale provides common.footerData
  const footerData = t('common.footerData');
  const links = footerData && Array.isArray(footerData.links) ? footerData.links : [];
  const leftLabel = footerData && footerData.leftLabel;
  const copyright = footerData && footerData.copyright;
  const useRichLayout = !!(leftLabel || links.length > 0 || copyright);

  if (useRichLayout) {
    return (
      <footer className="footer footer--rich" data-testid="portfolio-footer">
        <div className="footer-inner">
          <div className="footer-left">
            {leftLabel && <span className="footer-left-label">{leftLabel}</span>}
            {copyright && <p className="footer-copyright">{copyright}</p>}
          </div>
          {links.length > 0 && (
            <nav className="footer-links" aria-label="Footer links">
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target={link.url && !link.url.startsWith('mailto:') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </footer>
    );
  }

  // Legacy simple footer
  return (
    <footer className="footer" data-testid="portfolio-footer">
      <p>{t('common.footer')}</p>
    </footer>
  );
};

export default Footer;
