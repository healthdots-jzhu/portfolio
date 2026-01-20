import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAccessToken } from '../services/authService';
import { portfolioApi } from '../services/portfolioApi';
import { useAppLocale } from '../hooks/useAppLocale';
import { getVersionStatusLabel, getVersionStatusClass, VersionStatusNames } from '../utils/versionStatusEnum';
import './PortfolioEditor.css';

export default function PortfolioEditor() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const locale = useAppLocale();
  
  const [portfolio, setPortfolio] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [versions, setVersions] = useState([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPortfolioData();
  }, [personId]);

  useEffect(() => {
    if (portfolio) {
      loadLocaleContent();
    }
  }, [currentLanguage, portfolio]);

  useEffect(() => {
    setHasChanges(content !== originalContent);
  }, [content, originalContent]);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      
      if (!token) {
        navigate('/');
        return;
      }

      const portfolioData = await portfolioApi.getPortfolio(personId);
      setPortfolio(portfolioData);
      setLanguages(portfolioData.availableLanguages || ['en']);
      
      // Load versions
      const portfolioId = portfolioData.id;
      const versionHistory = await portfolioApi.getVersionHistory(portfolioId, token);
      setVersions(versionHistory);
    } catch (err) {
      console.error('Error loading portfolio:', err);
      setError(locale.portfolioEditor.failed);
    } finally {
      setLoading(false);
    }
  };

  const loadLocaleContent = async () => {
    try {
      const localeData = await portfolioApi.getLocale(personId, currentLanguage);
      const formatted = JSON.stringify(localeData, null, 2);
      setContent(formatted);
      setOriginalContent(formatted);
      setValidation(null);
    } catch (err) {
      console.error('Error loading locale:', err);
      if (err.message.includes('not found')) {
        setContent('{}');
        setOriginalContent('{}');
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await getAccessToken();
      const contentObj = JSON.parse(content);
      
      await portfolioApi.updateLocale(personId, currentLanguage, contentObj, token);
      setOriginalContent(content);
      setHasChanges(false);
      alert(locale.messages.changesSaved);
    } catch (err) {
      console.error('Error saving:', err);
      alert(`${locale.messages.failedToSave} ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    try {
      setValidating(true);
      const token = await getAccessToken();
      const result = await portfolioApi.validateLocale(
        portfolio.id,
        content,
        currentLanguage,
        token
      );
      setValidation(result);
    } catch (err) {
      console.error('Error validating:', err);
      alert(`${locale.validation.validationError} ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleCreateVersion = async () => {
    if (hasChanges) {
      alert(locale.messages.unsavedChangesWarning);
      return;
    }
    setShowVersionModal(true);
  };

  const handleSubmitVersion = async (stage = false) => {
    try {
      const token = await getAccessToken();
      await portfolioApi.createVersion(
        portfolio.id,
        versionLabel || null,
        versionDescription || null,
        stage,
        token
      );
      
      setShowVersionModal(false);
      setVersionLabel('');
      setVersionDescription('');
      
      // Reload version history
      const versionHistory = await portfolioApi.getVersionHistory(portfolio.id, token);
      setVersions(versionHistory);
      
      const message = stage ? locale.messages.versionCreatedAndStaged : locale.messages.versionCreated;
      alert(message);
    } catch (err) {
      console.error('Error creating version:', err);
      alert(`${locale.messages.failedToCreate} ${err.message}`);
    }
  };

  const handlePublishVersion = async (versionId) => {
    if (!confirm(locale.messages.confirmPublish)) {
      return;
    }

    try {
      const token = await getAccessToken();
      await portfolioApi.publishVersion(portfolio.id, versionId, token);
      
      // Reload version history
      const versionHistory = await portfolioApi.getVersionHistory(portfolio.id, token);
      setVersions(versionHistory);
      
      alert(locale.messages.versionPublished);
    } catch (err) {
      console.error('Error publishing version:', err);
      alert(`${locale.messages.failedToPublish} ${err.message}`);
    }
  };

  const handleStageVersion = async (versionId) => {
    try {
      const token = await getAccessToken();
      await portfolioApi.stageVersion(portfolio.id, versionId, token);
      
      // Reload version history
      const versionHistory = await portfolioApi.getVersionHistory(portfolio.id, token);
      setVersions(versionHistory);
      
      alert(locale.messages.versionStaged);
    } catch (err) {
      console.error('Error staging version:', err);
      alert(`${locale.messages.failedToStage} ${err.message}`);
    }
  };

  const handlePreviewVersion = async (versionId) => {
    const baseUrl = window.location.origin;
    const previewUrl = `${baseUrl}/${personId}?preview=${versionId}`;
    window.open(previewUrl, '_blank');
  };

  const handlePreviewLive = () => {
    const baseUrl = window.location.origin;
    const liveUrl = `${baseUrl}/${personId}`;
    window.open(liveUrl, '_blank');
  };

  const handleFormatJson = () => {
    try {
      const obj = JSON.parse(content);
      setContent(JSON.stringify(obj, null, 2));
    } catch (err) {
      alert(locale.errors.cannotFormat);
    }
  };

  if (loading) {
    return (
      <div className="portfolio-editor">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{locale.portfolioEditor.loadingEditor}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-editor">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => navigate('/portfolios')}>{locale.portfolioEditor.back}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-editor">
      <div className="editor-header">
        <div className="editor-title">
          <button className="btn-back" onClick={() => navigate('/portfolios')}>
            ← {locale.portfolioEditor.back}
          </button>
          <div>
            <h1>{portfolio?.displayName}</h1>
            <span className="subtitle">{personId}</span>
          </div>
        </div>
        <div className="editor-actions">
          <button className="btn-preview" onClick={handlePreviewLive}>
            {locale.portfolioEditor.previewLive}
          </button>
          <button className="btn-version" onClick={handleCreateVersion}>
            {locale.portfolioEditor.createVersion}
          </button>
          <button 
            className="btn-history"
            onClick={() => setShowVersionHistory(!showVersionHistory)}
          >
            {showVersionHistory ? locale.portfolioEditor.hideHistory : locale.portfolioEditor.showHistory}
          </button>
        </div>
      </div>

      <div className="editor-container">
        <div className="editor-sidebar">
          <div className="language-selector">
            <h3>{locale.portfolioEditor.languages}</h3>
            {languages.map((lang) => (
              <button
                key={lang}
                className={`lang-button ${currentLanguage === lang ? 'active' : ''}`}
                onClick={() => setCurrentLanguage(lang)}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {showVersionHistory && (
            <div className="version-history">
              <h3>{locale.portfolioEditor.versionHistory}</h3>
              <div className="version-list">
                {versions.map((version) => (
                  <div key={version.id} className="version-item">
                    <div className="version-header">
                      <span className="version-number">v{version.versionNumber}</span>
                      <span className={`version-status status-${getVersionStatusClass(version.status)}`}>
                        {getVersionStatusLabel(version.status, locale)}
                      </span>
                    </div>
                    {version.label && <div className="version-label">{version.label}</div>}
                    <div className="version-date">
                      {new Date(version.createdAt).toLocaleDateString()}
                    </div>
                    {version.isCurrentPublished && (
                      <div className="version-badge">{locale.portfolioEditor.currentLive}</div>
                    )}
                    <div className="version-actions">
                      {version.status === VersionStatusNames[0] && (
                        <>
                          <button onClick={() => handleStageVersion(version.id)}>{locale.portfolioEditor.stage}</button>
                          <button onClick={() => handlePublishVersion(version.id)}>{locale.portfolioEditor.publish}</button>
                        </>
                      )}
                      {version.status === VersionStatusNames[1] && (
                        <>
                          <button onClick={() => handlePreviewVersion(version.id)}>{locale.portfolioEditor.preview}</button>
                          <button onClick={() => handlePublishVersion(version.id)}>{locale.portfolioEditor.publish}</button>
                        </>
                      )}
                      {version.status === VersionStatusNames[2] && !version.isCurrentPublished && (
                        <button onClick={() => handlePublishVersion(version.id)}>{locale.portfolioEditor.republish}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="editor-main">
          <div className="editor-toolbar">
            <div className="toolbar-left">
              <span className="current-lang">{locale.portfolioEditor.editing} {currentLanguage.toUpperCase()}</span>
              {hasChanges && <span className="unsaved-indicator">{locale.portfolioEditor.unsavedChanges}</span>}
            </div>
            <div className="toolbar-right">
              <button onClick={handleFormatJson} className="btn-format">
                {locale.portfolioEditor.formatJson}
              </button>
              <button 
                onClick={handleValidate} 
                className="btn-validate"
                disabled={validating}
              >
                {validating ? locale.portfolioEditor.validating : locale.portfolioEditor.validate}
              </button>
              <button 
                onClick={handleSave} 
                className="btn-save"
                disabled={!hasChanges || saving}
              >
                {saving ? locale.portfolioEditor.saving : locale.portfolioEditor.save}
              </button>
            </div>
          </div>

          {validation && (
            <div className={`validation-result ${validation.isValid ? 'valid' : 'invalid'}`}>
              <div className="validation-header">
                {validation.isValid ? locale.portfolioEditor.validationPassed : locale.portfolioEditor.validationFailed}
              </div>
              {validation.errors && validation.errors.length > 0 && (
                <div className="validation-errors">
                  <strong>{locale.portfolioEditor.errors}</strong>
                  <ul>
                    {validation.errors.map((error, index) => (
                      <li key={index}>
                        <strong>{error.field}:</strong> {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {validation.warnings && validation.warnings.length > 0 && (
                <div className="validation-warnings">
                  <strong>{locale.portfolioEditor.warnings}</strong>
                  <ul>
                    {validation.warnings.map((warning, index) => (
                      <li key={index}>
                        <strong>{warning.field}:</strong> {warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <textarea
            className="editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter JSON content here..."
            spellCheck={false}
          />
        </div>
      </div>

      {showVersionModal && (
        <div className="modal-overlay" onClick={() => setShowVersionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Version</h2>
              <button className="modal-close" onClick={() => setShowVersionModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="versionLabel">{locale.portfolioEditor.versionLabel} {locale.portfolioManager.optional}</label>
                <input
                  type="text"
                  id="versionLabel"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder={locale.portfolioEditor.versionLabelHint}
                />
              </div>
              <div className="form-group">
                <label htmlFor="versionDescription">{locale.portfolioEditor.versionDescription} {locale.portfolioManager.optional}</label>
                <textarea
                  id="versionDescription"
                  value={versionDescription}
                  onChange={(e) => setVersionDescription(e.target.value)}
                  placeholder={locale.portfolioEditor.versionDescriptionHint}
                  rows="4"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowVersionModal(false)}>
                {locale.portfolioManager.cancel}
              </button>
              <button className="btn-secondary" onClick={() => handleSubmitVersion(false)}>
                {locale.portfolioEditor.createDraft}
              </button>
              <button className="btn-primary" onClick={() => handleSubmitVersion(true)}>
                {locale.portfolioEditor.createAndStage}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
