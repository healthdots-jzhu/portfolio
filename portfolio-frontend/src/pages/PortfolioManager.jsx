import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../services/authService';
import { portfolioApi } from '../services/portfolioApi';
import { useAppLocale } from '../hooks/useAppLocale';
import './PortfolioManager.css';

export default function PortfolioManager() {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    displayName: '',
    preferredPersonId: '',
    subdomain: '',
  });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const locale = useAppLocale();

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      
      if (!token) {
        navigate('/');
        return;
      }

      const data = await portfolioApi.getUserPortfolios(token);
      setPortfolios(data);
    } catch (err) {
      console.error('Error loading portfolios:', err);
      setError(locale.messages.failedToLoad);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = async (e) => {
    e.preventDefault();
    
    if (!createForm.displayName.trim()) {
      alert(locale.validation.required);
      return;
    }

    try {
      setCreating(true);
      const token = await getAccessToken();
      
      await portfolioApi.createPortfolio(
        createForm.displayName,
        createForm.preferredPersonId || null,
        createForm.subdomain || null,
        token
      );

      setShowCreateModal(false);
      setCreateForm({ displayName: '', preferredPersonId: '', subdomain: '' });
      await loadPortfolios();
    } catch (err) {
      console.error('Error creating portfolio:', err);
      alert(`${locale.messages.failedToCreatePortfolio} ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleEditPortfolio = (portfolio) => {
    navigate(`/portfolio-editor/${portfolio.personId}`);
  };

  const handlePreviewPortfolio = (portfolio) => {
    const baseUrl = window.location.origin;
    const previewUrl = `${baseUrl}/${portfolio.personId}`;
    window.open(previewUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="portfolio-manager">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{locale.portfolioEditor.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-manager">
      <div className="portfolio-manager-header">
        <h1>{locale.portfolioManager.title}</h1>
        <button 
          className="btn-create-portfolio"
          onClick={() => setShowCreateModal(true)}
        >
          + {locale.portfolioManager.createNew}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadPortfolios}>{locale.portfolioManager.retryLoad}</button>
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h2>{locale.portfolioManager.noPortfolios}</h2>
          <p>{locale.portfolioManager.noPortfoliosDesc}</p>
          <button 
            className="btn-create-portfolio-large"
            onClick={() => setShowCreateModal(true)}
          >
            {locale.portfolioManager.createPortfolio}
          </button>
        </div>
      ) : (
        <div className="portfolio-grid">
          {portfolios.map((portfolio) => (
            <div key={portfolio.id} className="portfolio-card">
              <div className="portfolio-card-header">
                <h3>{portfolio.displayName}</h3>
                <span className="portfolio-id">{portfolio.personId}</span>
              </div>
              
              <div className="portfolio-card-body">
                {portfolio.subdomain && (
                  <div className="portfolio-info">
                    <span className="info-label">Subdomain:</span>
                    <span className="info-value">{portfolio.subdomain}</span>
                  </div>
                )}
                
                <div className="portfolio-info">
                  <span className="info-label">{locale.portfolioManager.languages}:</span>
                  <span className="info-value">{portfolio.localeCount || 0}</span>
                </div>
                
                <div className="portfolio-info">
                  <span className="info-label">{locale.portfolioManager.assets}:</span>
                  <span className="info-value">{portfolio.assetCount || 0}</span>
                </div>
                
                <div className="portfolio-info">
                  <span className="info-label">{locale.portfolioManager.lastUpdated}:</span>
                  <span className="info-value">
                    {new Date(portfolio.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="portfolio-card-actions">
                <button 
                  className="btn-edit"
                  onClick={() => handleEditPortfolio(portfolio)}
                >
                  {locale.portfolioManager.edit}
                </button>
                <button 
                  className="btn-preview"
                  onClick={() => handlePreviewPortfolio(portfolio)}
                >
                  {locale.portfolioManager.preview}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{locale.portfolioManager.createNew}</h2>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreatePortfolio}>
              <div className="form-group">
                <label htmlFor="displayName">
                  {locale.portfolioManager.displayName} <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  placeholder="e.g., John Doe"
                  required
                  disabled={creating}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="preferredPersonId">
                  {locale.portfolioManager.personId} {locale.portfolioManager.optional}
                </label>
                <input
                  type="text"
                  id="preferredPersonId"
                  value={createForm.preferredPersonId}
                  onChange={(e) => setCreateForm({ ...createForm, preferredPersonId: e.target.value })}
                  placeholder="e.g., john-doe (leave blank to auto-generate)"
                  disabled={creating}
                />
                <small>{locale.portfolioManager.personIdHint}</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="subdomain">
                  {locale.portfolioManager.subdomain} {locale.portfolioManager.optional}
                </label>
                <input
                  type="text"
                  id="subdomain"
                  value={createForm.subdomain}
                  onChange={(e) => setCreateForm({ ...createForm, subdomain: e.target.value })}
                  placeholder="e.g., johndoe"
                  disabled={creating}
                />
                <small>{locale.portfolioManager.subdomainHint}</small>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  {locale.portfolioManager.cancel}
                </button>
                <button 
                  type="submit"
                  className="btn-submit"
                  disabled={creating}
                >
                  {creating ? locale.portfolioManager.creating : locale.portfolioManager.createPortfolioBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
