import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate, useLocation } from 'react-router-dom';
import { LanguageProvider, useTranslations } from './context/LanguageContext';
import { personExists, getAvailablePersons } from './locales';
import { applyFontFamily } from './utils/fontLoader';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import PersonHome from './pages/PersonHome';
import AboutMe from './pages/AboutMe';
import PersonProjects from './pages/PersonProjects';
import PersonContact from './pages/PersonContact';
import Engagements from './pages/Engagements';
import Specialties from './pages/Specialties';
import Cherish from './pages/Cherish';
import SimonSaves from './pages/SimonSaves';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfUse from './pages/TermsOfUse';
import './App.css';

// Subdomain to person ID mapping
const SUBDOMAIN_MAP = {
  'karen': 'karen-zhu-EU2O',
  'jason': 'jason-zhu-EU1O'
};

function SubdomainRedirect() {
  const location = useLocation();
  const hostname = window.location.hostname;
  
  // Extract subdomain (e.g., "karen" from "karen.healthdots.net")
  const subdomain = hostname.split('.')[0];
  
  // Check if we have a mapping for this subdomain and if path doesn't start with /p/
  if (SUBDOMAIN_MAP[subdomain] && !location.pathname.startsWith('/p/')) {
    const personId = SUBDOMAIN_MAP[subdomain];
    const newPath = `/p/${personId}${location.pathname === '/' ? '' : location.pathname}${location.search}${location.hash}`;
    return <Navigate to={newPath} replace />;
  }
  
  return null;
}

function PersonPortfolio() {
  const { t, fontFamily } = useTranslations();

  // Apply font family dynamically when it changes
  useEffect(() => {
    if (fontFamily) {
      applyFontFamily(fontFamily);
    }
  }, [fontFamily]);

  // Determine which components to render based on available sections
  const getRoutes = () => {
    const routes = [];

    // Home route - matches the person root (index route)
    routes.push(<Route key="home" index element={<PersonHome />} />);

    // About Me route
    routes.push(<Route key="about" path="about" element={<AboutMe />} />);

    // Other sections - relative paths
    if (t('engagements.title')) {
      routes.push(<Route key="engagements" path="engagements" element={<Engagements />} />);
    }

    if (t('specialties.title')) {
      routes.push(<Route key="specialties" path="specialties" element={<Specialties />} />);
    }

    if (t('projects.title')) {
      routes.push(<Route key="projects" path="projects" element={<PersonProjects />} />);
    }

    if (t('contact.title')) {
      routes.push(<Route key="contact" path="contact" element={<PersonContact />} />);
    }

    // Project-specific pages
    if (t('cherish.hero.title')) {
      routes.push(<Route key="cherish" path="cherish" element={<Cherish />} />);
    }

    if (t('simonSaves.hero.title')) {
      routes.push(<Route key="simonSaves" path="simonSaves" element={<SimonSaves />} />);
    }

    return routes;
  };

  return (
    <>
      <Navbar />
      <div className="main-content">
        <Routes>
          {getRoutes()}
        </Routes>
      </div>
      <Footer />
    </>
  );
}

function PersonLoader() {
  const { personId } = useParams();

  if (!personExists(personId)) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h1>Portfolio Not Found</h1>
        <p>The portfolio for "{personId}" could not be found.</p>
        {/* <p>Available portfolios: {getAvailablePersons().join(', ')}</p> */}
      </div>
    );
  }

  return (
    <LanguageProvider personId={personId}>
      <PersonPortfolio />
    </LanguageProvider>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Subdomain redirect - must be first to catch root and non-/p/ paths */}
        <Route path="*" element={<SubdomainRedirectWrapper />} />
      </Routes>
    </Router>
  );
}

function SubdomainRedirectWrapper() {
  const redirect = SubdomainRedirect();
  
  if (redirect) {
    return redirect;
  }
  
  return (
    <Routes>
      {/* Default landing page - no person ID required */}
      <Route path="/" element={<Landing />} />

      {/* Legal pages */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfUse />} />

      {/* Person-specific portfolios */}
      <Route path="/p/:personId/*" element={<PersonLoader />} />

      {/* 404 fallback */}
      <Route path="*" element={
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1>Portfolio Not Found</h1>
          <p>Please check the URL and try again.</p>
          {/* <p>Available portfolios: {getAvailablePersons().join(', ')}</p> */}
        </div>
      } />
    </Routes>
  );
}

export default App;
