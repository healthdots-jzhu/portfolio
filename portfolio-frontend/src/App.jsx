import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useTranslations } from './context/LanguageContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import RCFG from './pages/RCFG';
import Marketing from './pages/Marketing';
import './App.css';

function AppContent() {
  const { t } = useTranslations();

  useEffect(() => {
    document.title = t('common.baseTitle');
  }, [t]);

  return (
    <>
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rcfg" element={<RCFG />} />
          <Route path="/marketing" element={<Marketing />} />
        </Routes>
      </div>
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
