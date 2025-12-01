import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { LanguageProvider, useTranslations } from './context/LanguageContext';
import { personExists, getAvailablePersons } from './locales';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import PersonHome from './pages/PersonHome';
import AboutMe from './pages/AboutMe';
import PersonProjects from './pages/PersonProjects';
import PersonContact from './pages/PersonContact';
import Engagements from './pages/Engagements';
import Marketing from './pages/Marketing';
import './App.css';

function PersonPortfolio() {
  const { t } = useTranslations();

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

    if (t('marketing.title')) {
      routes.push(<Route key="marketing" path="marketing" element={<Marketing />} />);
    }

    if (t('projects.title')) {
      routes.push(<Route key="projects" path="projects" element={<PersonProjects />} />);
    }

    if (t('contact.title')) {
      routes.push(<Route key="contact" path="contact" element={<PersonContact />} />);
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

function App() {
  return (
    <Router>
      <Routes>
        {/* Default landing page - no person ID required */}
        <Route path="/" element={<Landing />} />

        {/* Person-specific portfolios */}
        <Route path="/p/:personId" element={<PersonLoader />} />
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
    </Router>
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

export default App;
