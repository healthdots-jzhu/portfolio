
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { getAccessToken } from '../services/authService';
import { portfolioApi } from '../services/portfolioApi';
import { useAppLocale } from '../hooks/useAppLocale';
import { getVersionStatusLabel, getVersionStatusClass, VersionStatusNames, VersionStatusEnum } from '../utils/versionStatusEnum';
import { validateLocaleContent } from '../utils/localeValidator';
import { LANGUAGE_OPTIONS, getLanguageName, searchLanguages } from '../utils/languageOptions';
import ThemeEditorPanel from '../components/ThemeEditorPanel';
import './PortfolioEditor.css';

export default function PortfolioEditor() {
    // Asset management states
    const [assets, setAssets] = useState([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [assetsError, setAssetsError] = useState(null);
    const [assetsPage, setAssetsPage] = useState(1);
    const [assetsPageSize, setAssetsPageSize] = useState(50);
    const [assetsTotal, setAssetsTotal] = useState(0);
    const [showCompareOverlay, setShowCompareOverlay] = useState(false);
    const [compareVersionA, setCompareVersionA] = useState('live');
    const [compareVersionB, setCompareVersionB] = useState('live');
    const [compareDiff, setCompareDiff] = useState([]);
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareError, setCompareError] = useState(null);
    const [showAiOverlay, setShowAiOverlay] = useState(false);
    const [aiArea, setAiArea] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiSelectedLanguages, setAiSelectedLanguages] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
  const [showThemeOverlay, setShowThemeOverlay] = useState(false);
  const { personId } = useParams();
  const navigate = useNavigate();
  const locale = useAppLocale();
  
  // Asset upload handler
  const handleAssetUpload = async (e) => {
    if (!e || !e.target || !e.target.files || !personId) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const token = await getAccessToken();
      for (const file of files) {
        // You may want to add validation here (type/size)
        await portfolioApi.uploadAsset(personId, file, token);
      }
      // Refresh asset list after upload
      const portfolioData = await portfolioApi.getPortfolioForEdit(personId, token, { noCache: true });
      let allAssets = Array.isArray(portfolioData.assets) ? portfolioData.assets : [];
      const total = allAssets.length;
      const start = (assetsPage - 1) * assetsPageSize;
      const end = start + assetsPageSize;
      const pagedAssets = allAssets.slice(start, end);
      setAssets(pagedAssets);
      setAssetsTotal(total);
    } catch (err) {
      setAssetsError((err && err.message) || 'Failed to upload asset');
    } finally {
      setAssetsLoading(false);
      // Reset file input so same file can be uploaded again if needed
      if (e.target) e.target.value = '';
    }
  };
  
  const [portfolio, setPortfolio] = useState(null);
  // Asset management overlay state
  const [showAssetsOverlay, setShowAssetsOverlay] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [draftContent, setDraftContent] = useState({}); // Track draft changes for all languages
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('live');
  const [currentVersion, setCurrentVersion] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState(null);
  const languageDropdownRef = useRef(null);

  const normalizeContentForDiff = (contentStr) => {
    if (contentStr === null || contentStr === undefined) return '';
    const raw = typeof contentStr === 'string' ? contentStr : JSON.stringify(contentStr);
    if (raw.trim() === '') return '';
    try {
      const obj = JSON.parse(raw);
      return JSON.stringify(obj, null, 2);
    } catch {
      return raw;
    }
  };

  const computeLineDiff = (leftText, rightText) => {
    const leftLines = leftText.split('\n');
    const rightLines = rightText.split('\n');
    const n = leftLines.length;
    const m = rightLines.length;
    const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (leftLines[i] === rightLines[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const diff = [];
    let i = 0;
    let j = 0;
    let leftLine = 1;
    let rightLine = 1;

    while (i < n && j < m) {
      if (leftLines[i] === rightLines[j]) {
        diff.push({
          type: 'context',
          text: leftLines[i],
          leftLine,
          rightLine
        });
        i++;
        j++;
        leftLine++;
        rightLine++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        diff.push({
          type: 'del',
          text: leftLines[i],
          leftLine,
          rightLine: null
        });
        i++;
        leftLine++;
      } else {
        diff.push({
          type: 'add',
          text: rightLines[j],
          leftLine: null,
          rightLine
        });
        j++;
        rightLine++;
      }
    }

    while (i < n) {
      diff.push({
        type: 'del',
        text: leftLines[i],
        leftLine,
        rightLine: null
      });
      i++;
      leftLine++;
    }

    while (j < m) {
      diff.push({
        type: 'add',
        text: rightLines[j],
        leftLine: null,
        rightLine
      });
      j++;
      rightLine++;
    }

    return diff;
  };

  const getVersionOptionLabel = (versionId) => {
    if (versionId === 'live') {
      return locale.portfolioEditor.currentLive || 'Live';
    }
    const version = versions.find((v) => v.id === versionId);
    if (!version) return versionId;
    const status = getVersionStatusLabel(version.status, locale);
    const labelSuffix = version.label ? ` · ${version.label}` : '';
    return `v${version.versionNumber} (${status})${labelSuffix}`;
  };

  const handleOpenCompare = () => {
    const defaultA = selectedVersionId || 'live';
    let defaultB = defaultA === 'live' ? (versions[0]?.id || 'live') : 'live';

    if (defaultA === defaultB && versions.length > 0) {
      const fallback = versions.find((v) => v.id !== defaultA);
      defaultB = fallback ? fallback.id : defaultB;
    }

    setCompareVersionA(defaultA);
    setCompareVersionB(defaultB);
    setCompareDiff([]);
    setCompareError(null);
    setShowCompareOverlay(true);
  };

  const fetchCompareContent = async (versionId, language) => {
    if (versionId === 'live') {
      return await portfolioApi.getLocale(personId, language, { noCache: true });
    }

    const token = await getAccessToken();
    const versionDetail = await portfolioApi.getVersion(portfolio.id, versionId, token);
    if (versionDetail && versionDetail.localeContent && versionDetail.localeContent[language]) {
      const content = versionDetail.localeContent[language];
      return typeof content === 'string' ? content : JSON.stringify(content);
    }
    return '{}';
  };

  const handleShowDifferences = async () => {
    if (compareVersionA === compareVersionB) {
      setCompareError(locale.portfolioEditor.compareSameVersion || 'Please select two different versions.');
      return;
    }

    try {
      setCompareLoading(true);
      setCompareError(null);
      const [leftContent, rightContent] = await Promise.all([
        fetchCompareContent(compareVersionA, currentLanguage),
        fetchCompareContent(compareVersionB, currentLanguage)
      ]);

      const normalizedLeft = normalizeContentForDiff(leftContent);
      const normalizedRight = normalizeContentForDiff(rightContent);
      const diff = computeLineDiff(normalizedLeft, normalizedRight);
      setCompareDiff(diff);
    } catch (err) {
      setCompareError((err && err.message) || 'Failed to compare versions');
    } finally {
      setCompareLoading(false);
    }
  };

  const handleOpenAi = () => {
    setAiArea('');
    setAiPrompt('');
    setAiSelectedLanguages([currentLanguage]);
    setAiError(null);
    setShowAiOverlay(true);
  };

  const handleAiSubmit = async () => {
    if (!aiArea) {
      setAiError(locale.portfolioEditor.aiAreaRequired || 'Please select an area to modify');
      return;
    }
    if (!aiPrompt.trim()) {
      setAiError(locale.portfolioEditor.aiPromptRequired || 'Please describe what you want to change');
      return;
    }
    if (aiSelectedLanguages.length === 0) {
      setAiError(locale.portfolioEditor.aiLanguageRequired || 'Please select at least one language');
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);
      const token = await getAccessToken();

      const versionId = selectedVersionId === 'live' ? null : selectedVersionId;

      const result = await portfolioApi.generateLocaleWithAI(
        personId,
        currentLanguage,
        aiArea,
        aiPrompt,
        versionId,
        aiSelectedLanguages,
        token
      );

      // Success - close overlay, refresh data, and show comparison
      setShowAiOverlay(false);
      setAiLoading(false);

      // Reload portfolio and versions
      portfolioApi.clearCache();
      await loadPortfolioData();

      // Switch to the new/updated version
      setSelectedVersionId(result.versionId);

      // Open compare overlay to show changes
      setCompareVersionA('live');
      setCompareVersionB(result.versionId);
      setShowCompareOverlay(true);

      // Automatically show differences
      setTimeout(async () => {
        try {
          const [leftContent, rightContent] = await Promise.all([
            fetchCompareContent('live', currentLanguage),
            fetchCompareContent(result.versionId, currentLanguage)
          ]);
          const normalizedLeft = normalizeContentForDiff(leftContent);
          const normalizedRight = normalizeContentForDiff(rightContent);
          const diff = computeLineDiff(normalizedLeft, normalizedRight);
          setCompareDiff(diff);
        } catch (err) {
          console.error('Failed to show diff:', err);
        }
      }, 500);

    } catch (err) {
      setAiError((err && err.message) || 'Failed to generate content with AI');
      setAiLoading(false);
    }
  };

  const toggleAiLanguage = (lang) => {
    if (aiSelectedLanguages.includes(lang)) {
      setAiSelectedLanguages(aiSelectedLanguages.filter(l => l !== lang));
    } else {
      setAiSelectedLanguages([...aiSelectedLanguages, lang]);
    }
  };

  // Fetch assets when overlay opens or paging changes
  useEffect(() => {
    const fetchAssets = async () => {
      if (!showAssetsOverlay) return;
      setAssetsLoading(true);
      setAssetsError(null);
      try {
        const token = await getAccessToken();
        const portfolioData = await portfolioApi.getPortfolioForEdit(personId, token, { noCache: true });
        // Assume assets are in portfolioData.assets (array of { key, name, size, ... })
        let allAssets = Array.isArray(portfolioData.assets) ? portfolioData.assets : [];
        // Paging logic
        const total = allAssets.length;
        const start = (assetsPage - 1) * assetsPageSize;
        const end = start + assetsPageSize;
        const pagedAssets = allAssets.slice(start, end);
        setAssets(pagedAssets);
        setAssetsTotal(total);
      } catch (err) {
        setAssetsError((err && err.message) || 'Failed to load assets');
        setAssets([]);
        setAssetsTotal(0);
      } finally {
        setAssetsLoading(false);
      }
    };
    fetchAssets();
  }, [showAssetsOverlay, assetsPage, assetsPageSize, personId]);

  // Determine if current view should be read-only (Live, Published, or Archived version)
  const isReadOnlyVersion = selectedVersionId === 'live' || 
    (selectedVersionId !== 'live' &&
    !!currentVersion &&
    (currentVersion.status === VersionStatusEnum.Published || currentVersion.status === VersionStatusEnum.Archived));

  useEffect(() => {
    loadPortfolioData();
  }, [personId]);

  useEffect(() => {
    if (portfolio) {
      loadLocaleContent();
    }
  }, [currentLanguage, portfolio, selectedVersionId]);

  // Update available languages when switching between live and versions
  useEffect(() => {
    const updateAvailableLanguages = async () => {
      if (!portfolio) return;
      
      if (selectedVersionId === 'live') {
        // For live, use portfolio's available languages
        setLanguages(portfolio.availableLanguages || ['en']);
      } else {
        // For versions, get languages from version snapshot
        try {
          const token = await getAccessToken();
          const versionDetail = await portfolioApi.getVersion(portfolio.id, selectedVersionId, token);
          
          if (versionDetail && versionDetail.localeContent) {
            // Get languages from snapshot, excluding empty ones
            const versionLanguages = Object.keys(versionDetail.localeContent).filter(lang => {
              const content = versionDetail.localeContent[lang];
              const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
              return contentStr && contentStr.trim() !== '' && contentStr !== '{}';
            });
            setLanguages(versionLanguages.length > 0 ? versionLanguages : ['en']);
          }
        } catch (err) {
          console.error('Error loading version languages:', err);
        }
      }
    };
    
    updateAvailableLanguages();
  }, [selectedVersionId, portfolio]);

  useEffect(() => {
    setHasChanges(content !== originalContent);
    // Also track this language's changes in draftContent
    if (content !== originalContent) {
      setDraftContent(prev => ({
        ...prev,
        [currentLanguage]: content
      }));
    }
  }, [content, originalContent, currentLanguage]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
    };

    if (showLanguageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLanguageDropdown]);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      
      if (!token) {
        navigate('/');
        return;
      }

      const portfolioData = await portfolioApi.getPortfolioForEdit(personId, token, { noCache: true });
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
    // Capture the current language at the start to avoid closure issues
    const languageToLoad = currentLanguage;
    
    try {
      setViewLoading(true);
      let localeData;
      
      if (selectedVersionId === 'live') {
        // Load from live content
        localeData = await portfolioApi.getLocale(personId, languageToLoad, { noCache: true });
        setCurrentVersion(null);
      } else {
        // Load from specific version - get full version data and extract the language
        const token = await getAccessToken();
        const versionDetail = await portfolioApi.getVersion(portfolio.id, selectedVersionId, token);
        
        // Extract the specific language from localeContent
        if (versionDetail && versionDetail.localeContent && versionDetail.localeContent[languageToLoad]) {
          const content = versionDetail.localeContent[languageToLoad];
          localeData = typeof content === 'string' ? content : JSON.stringify(content);
        } else {
          // If language doesn't exist in version, return empty object
          localeData = '{}';
        }
        
        // Set the current version object
        setCurrentVersion(versionDetail || null);
      }
      
      // localeData is a raw JSON string from the API
      // Always set originalContent to the fresh API data
      setOriginalContent(localeData);
      
      // Check if there's unsaved draft content for this language
      const hasDraft = draftContent[languageToLoad] && draftContent[languageToLoad] !== localeData;
      
      if (hasDraft) {
        // Restore draft
        setContent(draftContent[languageToLoad]);
      } else {
        // Clear any stale draft for this language and use fresh API data
        setDraftContent(prev => {
          const newDraft = { ...prev };
          delete newDraft[languageToLoad];
          return newDraft;
        });
        setContent(localeData);
      }
      
      setValidation(null);
    } catch (err) {
      console.error('Error loading locale:', err);
      setContent('{}');
      setOriginalContent('{}');
    } finally {
      setViewLoading(false);
    }
  };

  // Helper function to normalize empty content to empty object
  const normalizeContent = (contentStr) => {
    if (!contentStr || contentStr.trim() === '') {
      return '{}';
    }
    return contentStr;
  };

  const handleSave = async () => {
    if (isReadOnlyVersion) {
      alert(locale.portfolioEditor.readOnlyNoEdits || 'This version is read-only. Copy to a new draft to make edits.');
      return;
    }
    try {
      setSaving(true);
      setValidation({ isValid: true, errors: [] });

      // Get list of languages with changes (current + any drafts)
      const languagesToSave = [currentLanguage];
      Object.keys(draftContent).forEach(lang => {
        if (!languagesToSave.includes(lang)) {
          languagesToSave.push(lang);
        }
      });

      // Validate all languages before saving
      for (const lang of languagesToSave) {
        const contentToValidate = draftContent[lang] || content;
        const frontendValidation = validateLocaleContent(contentToValidate, lang);
        
        if (!frontendValidation.isValid) {
          setValidation(frontendValidation);
          alert(`${lang.toUpperCase()}: ${locale.validation.validationError}\n` + 
                frontendValidation.errors.map(e => `${e.field}: ${e.message}`).join('\n'));
          setSaving(false);
          return;
        }
      }

      const token = await getAccessToken();

      // Validate with backend for all languages
      for (const lang of languagesToSave) {
        const contentToValidate = draftContent[lang] || content;
        const backendValidation = await portfolioApi.validateLocale(
          portfolio.id,
          contentToValidate,
          lang,
          token
        );

        if (!backendValidation.isValid) {
          setValidation(backendValidation);
          alert(`${lang.toUpperCase()}: ${locale.validation.validationError}\n` + 
                backendValidation.errors.map(e => `${e.field}: ${e.message}`).join('\n'));
          setSaving(false);
          return;
        }
      }

      // Clear any previous validation errors
      setValidation({ isValid: true, errors: [] });
      
      if (selectedVersionId === 'live') {
        // Saving from Live creates a new Draft version
        // First, update the live content for all languages
        for (const lang of languagesToSave) {
          // Save the text exactly as in the editor, no serialization
          const contentToSave = draftContent[lang] || content;
          await portfolioApi.updateLocale(personId, lang, contentToSave, token);
        }
        
        // Then create a draft version snapshot
        const newVersion = await portfolioApi.createVersion(
          portfolio.id,
          null, // No label
          null, // No description
          false, // Not published
          token
        );
        
        // Reload versions and switch to the new draft
        const versionHistory = await portfolioApi.getVersionHistory(portfolio.id, token);
        setVersions(versionHistory);
        setSelectedVersionId(newVersion.id);
        
        // Clear cache and reload portfolio data to refresh available languages
        portfolioApi.clearCache();
        const updatedPortfolio = await portfolioApi.getPortfolio(personId, { noCache: true });
        setPortfolio(updatedPortfolio);
        setLanguages(updatedPortfolio.availableLanguages || ['en']);
        
        alert(locale.messages.draftVersionCreated);
      } else {
        // When editing a draft/staged version, save changes to that version's snapshot for all languages
        for (const lang of languagesToSave) {
          // Save the text exactly as in the editor, no serialization
          const contentToSave = draftContent[lang] || content;
          await portfolioApi.updateVersionLocale(
            portfolio.id,
            selectedVersionId,
            lang,
            contentToSave,
            token
          );
        }
        
        // Clear cache and reload portfolio data to refresh available languages (in case any were emptied)
        portfolioApi.clearCache();
        const updatedPortfolio = await portfolioApi.getPortfolio(personId, { noCache: true });
        setPortfolio(updatedPortfolio);
        setLanguages(updatedPortfolio.availableLanguages || ['en']);
        
        alert(locale.messages.changesSaved);
      }
      
      setOriginalContent(content);
      setHasChanges(false);
      setDraftContent({}); // Clear all draft content after save
      setValidation(null);
    } catch (err) {
      console.error('Error saving:', err);
      alert(`${locale.messages.failedToSave} ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStage = async () => {
    if (isReadOnlyVersion) {
      alert(locale.portfolioEditor.readOnlyNoEdits || 'This version is read-only. Copy to a new draft to make edits.');
      return;
    }
    try {
      setSaving(true);
      setValidation({ isValid: true, errors: [] });

      // Get list of languages with changes (current + any drafts)
      const languagesToValidate = [currentLanguage];
      Object.keys(draftContent).forEach(lang => {
        if (!languagesToValidate.includes(lang)) {
          languagesToValidate.push(lang);
        }
      });

      // Validate all languages before staging
      for (const lang of languagesToValidate) {
        const contentToValidate = draftContent[lang] || content;
        const frontendValidation = validateLocaleContent(contentToValidate, lang);
        
        if (!frontendValidation.isValid) {
          setValidation(frontendValidation);
          alert(`${lang.toUpperCase()}: ${locale.validation.validationError}\\n` + 
                frontendValidation.errors.map(e => `${e.field}: ${e.message}`).join('\\n'));
          setSaving(false);
          return;
        }
      }

      const token = await getAccessToken();

      // Validate with backend for all languages before staging
      for (const lang of languagesToValidate) {
        const contentToValidate = draftContent[lang] || content;
        const backendValidation = await portfolioApi.validateLocale(
          portfolio.id,
          contentToValidate,
          lang,
          token
        );

        if (!backendValidation.isValid) {
          setValidation(backendValidation);
          alert(`${lang.toUpperCase()}: ${locale.validation.validationError}\\n` + 
                backendValidation.errors.map(e => `${e.field}: ${e.message}`).join('\\n'));
          setSaving(false);
          return;
        }
      }

      // Clear any previous validation errors
      setValidation({ isValid: true, errors: [] });
      
      // Save all drafted languages to this version's snapshot first
      for (const lang of languagesToValidate) {
        const contentToSave = normalizeContent(draftContent[lang] || content);
        await portfolioApi.updateVersionLocale(
          portfolio.id,
          selectedVersionId,
          lang,
          contentToSave,
          token
        );
      }
      
      // Now stage the version using the correct API
      await portfolioApi.stageVersion(portfolio.id, selectedVersionId, token);
      
      // Reload versions
      const versionHistory = await portfolioApi.getVersionHistory(portfolio.id, token);
      setVersions(versionHistory);
      
      // Update currentVersion
      const updated = versionHistory.find(v => v.id === selectedVersionId);
      setCurrentVersion(updated || null);
      
      setHasChanges(false);
      setDraftContent({}); // Clear all draft content after stage
      alert(locale.messages.versionStaged);
    } catch (err) {
      console.error('Error staging version:', err);
      alert(`${locale.messages.failedToStage} ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isReadOnlyVersion) {
      alert(locale.portfolioEditor.readOnlyNoEdits || 'This version is read-only. Copy to a new draft to make edits.');
      return;
    }
    try {
      setSaving(true);
      setValidation({ isValid: true, errors: [] });

      // Get list of languages with changes (current + any drafts)
      const languagesToValidate = [currentLanguage];
      Object.keys(draftContent).forEach(lang => {
        if (!languagesToValidate.includes(lang)) {
          languagesToValidate.push(lang);
        }
      });

      // Validate all languages before publishing
      for (const lang of languagesToValidate) {
        const contentToValidate = draftContent[lang] || content;
        const frontendValidation = validateLocaleContent(contentToValidate, lang);
        
        if (!frontendValidation.isValid) {
          setValidation(frontendValidation);
          alert(`${lang.toUpperCase()}: ${locale.validation.validationError}\\n` + 
                frontendValidation.errors.map(e => `${e.field}: ${e.message}`).join('\\n'));
          setSaving(false);
          return;
        }
      }

      const token = await getAccessToken();

      // Validate with backend for all languages before publishing
      for (const lang of languagesToValidate) {
        const contentToValidate = draftContent[lang] || content;
        const backendValidation = await portfolioApi.validateLocale(
          portfolio.id,
          contentToValidate,
          lang,
          token
        );

        if (!backendValidation.isValid) {
          setValidation(backendValidation);
          alert(`${lang.toUpperCase()}: ${locale.validation.validationError}\\n` + 
                backendValidation.errors.map(e => `${e.field}: ${e.message}`).join('\\n'));
          setSaving(false);
          return;
        }
      }

      // Clear any previous validation errors
      setValidation({ isValid: true, errors: [] });
      
      // Save all drafted languages to this version's snapshot first
      for (const lang of languagesToValidate) {
        const contentToSave = normalizeContent(draftContent[lang] || content);
        await portfolioApi.updateVersionLocale(
          portfolio.id,
          selectedVersionId,
          lang,
          contentToSave,
          token
        );
      }
      await portfolioApi.publishVersion(portfolio.id, selectedVersionId, token);
      
      // Reload versions
      const versionHistory = await portfolioApi.getVersionHistory(portfolio.id, token);
      setVersions(versionHistory);
      
      // Update currentVersion
      const updated = versionHistory.find(v => v.id === selectedVersionId);
      setCurrentVersion(updated || null);
      
      setHasChanges(false);
      setDraftContent({}); // Clear all draft content after publish
      alert(locale.messages.versionPublished);
    } catch (err) {
      console.error('Error publishing version:', err);
      alert(`${locale.messages.failedToPublish} ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToNewVersion = async () => {
    try {
      setSaving(true);
      const token = await getAccessToken();
      
      let newVersion;
      
      if (selectedVersionId === 'live') {
        // For live version, create a new draft snapshot from current state
        newVersion = await portfolioApi.createVersion(
          portfolio.id,
          null,
          'Copied from live',
          false,
          token
        );
      } else {
        // Copy content from the selected version to a new draft
        newVersion = await portfolioApi.copyVersionToNew(
          portfolio.id,
          selectedVersionId,
          token
        );
      }
      
      // Reload versions and switch to the new draft
      const versionHistory = await portfolioApi.getVersionHistory(portfolio.id, token);
      setVersions(versionHistory);
      setSelectedVersionId(newVersion.id);
      
      alert(locale.messages.versionCopied);
    } catch (err) {
      console.error('Error copying version:', err);
      alert(`${locale.messages.failedToCopy} ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (selectedVersionId === 'live') return;

    const version = currentVersion || versions.find((v) => v.id === selectedVersionId);
    if (!version || version.status === VersionStatusEnum.Published) {
      alert(locale.messages.cannotDeletePublished);
      return;
    }

    if (!confirm(locale.messages.confirmDeleteVersion)) {
      return;
    }

    try {
      setSaving(true);
      setViewLoading(true);
      const token = await getAccessToken();
      await portfolioApi.deleteVersion(portfolio.id, selectedVersionId, token);

      const versionHistory = await portfolioApi.getVersionHistory(portfolio.id, token);
      setVersions(versionHistory);
      
      // Switch to live and load its content explicitly
      setSelectedVersionId('live');
      setCurrentVersion(null);
      setHasChanges(false);
      setValidation(null);
      
      // Load live content directly (don't rely on state update)
      const liveContent = await portfolioApi.getLocale(personId, currentLanguage, { noCache: true });
      setContent(liveContent);
      setOriginalContent(liveContent);
      setViewLoading(false);

      alert(locale.messages.versionDeleted);
    } catch (err) {
      console.error('Error deleting version:', err);
      alert(`${locale.messages.failedToDelete} ${err.message}`);
      setViewLoading(false);
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    try {
      setValidating(true);
      
      // Perform frontend validation first
      const frontendValidation = validateLocaleContent(content, currentLanguage);
      
      if (!frontendValidation.isValid) {
        // Show frontend validation errors immediately
        setValidation(frontendValidation);
        setValidating(false);
        return;
      }
      
      // If frontend validation passes, call backend for additional checks
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

  const handlePreview = () => {
    const baseUrl = window.location.origin;
    if (selectedVersionId === 'live') {
      // Preview live content
      const liveUrl = `${baseUrl}/p/${personId}`;
      window.open(liveUrl, '_blank');
    } else {
      // Preview specific version using path-based routing
      const previewUrl = `${baseUrl}/preview/${selectedVersionId}/${personId}`;
      window.open(previewUrl, '_blank');
    }
  };

  const handleFormatJson = () => {
    try {
      // Parse and format with proper indentation while preserving field order
      const obj = JSON.parse(content);
      const formatted = JSON.stringify(obj, null, 2);
      setContent(formatted);
    } catch (err) {
      console.error('Format error:', err);
      alert(locale.messages?.errors?.cannotFormat || 'Cannot format JSON');
    }
  };

  const handleSelectLanguage = async (langCode) => {
    setShowLanguageDropdown(false);
    setLanguageSearch('');
    
    // In read-only versions, prevent adding new languages
    if (isReadOnlyVersion && !languages.includes(langCode)) {
      alert(locale.portfolioEditor.readOnlyCannotAddLanguage || 'This version is read-only. Copy to a new version to add languages.');
      return;
    }

    // If language doesn't exist, create it (only allowed when not read-only)
    if (!languages.includes(langCode)) {
      try {
        const token = await getAccessToken();
        // Create with empty JSON object
        await portfolioApi.updateLocale(personId, langCode, JSON.stringify({}), token);
        setLanguages([...languages, langCode].sort());
      } catch (err) {
        console.error('Error creating language:', err);
        alert(`Failed to create language: ${err.message}`);
        return;
      }
    }
    
    setCurrentLanguage(langCode);
  };

  const getFilteredLanguages = () => {
    const query = languageSearch.toLowerCase();
    let options = query ? searchLanguages(query) : LANGUAGE_OPTIONS;
    
    // Separate into saved and unsaved languages
    const savedLanguages = options.filter(opt => languages.includes(opt.code));
    const unsavedLanguages = options.filter(opt => !languages.includes(opt.code));
    
    // If version is read-only, only show saved languages to avoid confusion
    if (isReadOnlyVersion) {
      return [...savedLanguages];
    }

    // Return saved languages first, then unsaved
    return [...savedLanguages, ...unsavedLanguages];
  };

  const renderSelectedVersionChip = () => {
    if (selectedVersionId === 'live') {
      return (
        <span className="selected-version-chip">
          {locale.portfolioEditor.currentLive}
        </span>
      );
    }

    const version = currentVersion || versions.find((v) => v.id === selectedVersionId);
    if (!version) return null;

    const status = getVersionStatusLabel(version.status, locale);
    const labelSuffix = version.label ? ` · ${version.label}` : '';

    return (
      <span className="selected-version-chip">
        {`v${version.versionNumber} (${status})${labelSuffix}`}
      </span>
    );
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
          <button 
            className="btn-assets"
            onClick={() => setShowAssetsOverlay(true)}
          >
            {locale.portfolioEditor.manageAssets || 'Manage Assets'}
          </button>
          {!isReadOnlyVersion && (
            <button
              className="btn-theme"
              onClick={() => setShowThemeOverlay(true)}
            >
              {locale.portfolioEditor.themeEditor || 'Theme'}
            </button>
          )}
          {!isReadOnlyVersion && (
            <button className="btn-ai" onClick={handleOpenAi}>
              {locale.portfolioEditor.tryAi || 'Try AI'}
            </button>
          )}
          <button className="btn-compare" onClick={handleOpenCompare}>
            {locale.portfolioEditor.compare || 'Compare'}
          </button>
          <button className="btn-preview" onClick={handlePreview}>
            {locale.portfolioEditor.preview || 'Preview'}
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
        {/* Asset Management Overlay */}
        {showAssetsOverlay && (
          <div className="assets-overlay">
            <div className="assets-modal">
              <div className="assets-modal-header">
                <h2>{locale.assets?.manageAssets || 'Manage Assets'}</h2>
                <button className="assets-modal-close" onClick={() => setShowAssetsOverlay(false)} aria-label="Close">✕</button>
              </div>
              {/* Upload button below Close (x) button */}
              <div className="assets-upload-link-row">
                <label htmlFor="asset-upload-input" className="assets-upload-label">
                  <button
                    type="button"
                    className="assets-upload-link"
                    onClick={() => document.getElementById('asset-upload-input').click()}
                  >
                    {locale.assets?.upload || 'Upload Asset'}
                  </button>
                  <input
                    id="asset-upload-input"
                    type="file"
                    style={{ display: 'none' }}
                    multiple
                    onChange={handleAssetUpload}
                  />
                </label>
              </div>
              <div className="assets-modal-content">
                {/* Asset List */}
                {assetsLoading ? (
                  <div className="assets-loading">{locale.assets?.loading || 'Loading assets...'}</div>
                ) : assetsError ? (
                  <div className="assets-error">{assetsError}</div>
                ) : (
                  <>
                    <div className="assets-list">
                      {assets.length === 0 ? (
                        <div className="assets-empty">{locale.assets?.empty || 'No assets found.'}</div>
                      ) : (
                        <ul>
                          {assets.map((asset) => {
                            const filename = asset.name ?? asset.key ?? asset.assetKey ?? (asset.url ? asset.url.split('/').pop() : 'file');
                            const sizeBytes = asset.fileSize ?? asset.FileSize ?? asset.size ?? 0;
                            const sizeKB = (sizeBytes / 1024).toFixed(1);
                            const reactKey = asset.assetKey ?? asset.key ?? asset.id ?? filename;
                            const url = asset.url ?? asset.Url ?? asset.s3Url ?? asset.S3Url ?? null;
                            const fileType = (asset.fileType ?? asset.FileType ?? '').toLowerCase();
                            const isImage = fileType.startsWith('image/') || (url && /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(url));
                            // derive extension label for non-image icons
                            const ext = (filename && filename.includes('.')) ? filename.split('.').pop().toUpperCase() : 'FILE';

                            return (
                              <li key={reactKey} className="asset-item">
                                {url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="asset-link">
                                    {isImage ? (
                                      <img src={url} alt={filename} className="asset-thumb" />
                                    ) : (
                                      <span className={`asset-icon`} aria-hidden>{ext}</span>
                                    )}
                                  </a>
                                ) : (
                                  isImage ? (
                                    <img src={url || ''} alt={filename} className="asset-thumb" />
                                  ) : (
                                    <span className={`asset-icon`} aria-hidden>{ext}</span>
                                  )
                                )}
                                <div className="asset-meta">
                                  <span className="asset-name">{filename}</span>
                                  <span className="asset-size">{sizeKB} KB</span>
                                </div>
                                <button
                                  className="version-delete-btn asset-delete"
                                  title={locale.assets?.delete || 'Delete'}
                                  aria-label={locale.assets?.delete || 'Delete'}
                                  onClick={async (ev) => {
                                    ev.stopPropagation();
                                    if (!confirm(locale.assets?.confirmDelete || 'Delete this asset?')) return;
                                    try {
                                      const token = await getAccessToken();
                                      await portfolioApi.deleteAsset(personId, asset.id || asset.Id || asset.assetKey, token);
                                      // Refresh asset list
                                      const portfolioData = await portfolioApi.getPortfolioForEdit(personId, token, { noCache: true });
                                      const allAssets = Array.isArray(portfolioData.assets) ? portfolioData.assets : [];
                                      setAssets(allAssets.slice((assetsPage - 1) * assetsPageSize, (assetsPage - 1) * assetsPageSize + assetsPageSize));
                                      setAssetsTotal(allAssets.length);
                                    } catch (err) {
                                      alert((err && err.message) || locale.assets?.deleteFailed || 'Failed to delete asset');
                                    }
                                  }}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {/* Paging Controls (hidden if <= 10 files) */}
                    {assetsTotal > 10 && (
                      <div className="assets-paging">
                        <button disabled={assetsPage === 1} onClick={() => setAssetsPage(assetsPage - 1)}>{locale.assets?.prev || 'Prev'}</button>
                        <span>{locale.assets?.page || 'Page'} {assetsPage} {locale.assets?.of || 'of'} {Math.ceil(assetsTotal / assetsPageSize) || 1}</span>
                        <button disabled={assetsPage * assetsPageSize >= assetsTotal} onClick={() => setAssetsPage(assetsPage + 1)}>{locale.assets?.next || 'Next'}</button>
                        <label>
                          {locale.assets?.show || 'Show'}
                          <select value={assetsPageSize} onChange={e => setAssetsPageSize(Number(e.target.value))}>
                            {[10, 25, 50, 100].map(size => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                          {locale.assets?.files || 'files'}
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="assets-modal-backdrop" onClick={() => setShowAssetsOverlay(false)}></div>
          </div>
        )}
        {showCompareOverlay && (
          <div className="compare-overlay">
            <div className="compare-modal">
              <div className="compare-modal-header">
                <div>
                  <h2>{locale.portfolioEditor.compare || 'Compare Versions'}</h2>
                  <div className="compare-subtitle">
                    {locale.portfolioEditor.compareSubtitle || `Language: ${currentLanguage.toUpperCase()}`}
                  </div>
                </div>
                <button
                  className="compare-modal-close"
                  onClick={() => setShowCompareOverlay(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="compare-modal-body">
                <div className="compare-form">
                  <div className="compare-field">
                    <label>{locale.portfolioEditor.compareVersionA || 'Version A'}</label>
                    <select
                      value={compareVersionA}
                      onChange={(e) => {
                        setCompareVersionA(e.target.value);
                        setCompareError(null);
                        setCompareDiff([]);
                      }}
                    >
                      <option value="live">{getVersionOptionLabel('live')}</option>
                      {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {getVersionOptionLabel(version.id)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="compare-field">
                    <label>{locale.portfolioEditor.compareVersionB || 'Version B'}</label>
                    <select
                      value={compareVersionB}
                      onChange={(e) => {
                        setCompareVersionB(e.target.value);
                        setCompareError(null);
                        setCompareDiff([]);
                      }}
                    >
                      <option value="live">{getVersionOptionLabel('live')}</option>
                      {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {getVersionOptionLabel(version.id)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(compareVersionA === compareVersionB || compareError) && (
                    <div className="compare-error">
                      {compareError || (locale.portfolioEditor.compareSameVersion || 'Please select two different versions.')}
                    </div>
                  )}
                  <div className="compare-actions">
                    <button
                      className="compare-show-btn"
                      onClick={handleShowDifferences}
                      disabled={compareLoading || compareVersionA === compareVersionB}
                    >
                      {compareLoading
                        ? (locale.portfolioEditor.comparing || 'Comparing...')
                        : (locale.portfolioEditor.showDifferences || 'Show Differences')}
                    </button>
                  </div>
                </div>

                <div className="compare-diff">
                  {compareDiff.length > 0 && (
                    <div className="diff-header">
                      <span className="diff-title">
                        {getVersionOptionLabel(compareVersionA)} → {getVersionOptionLabel(compareVersionB)}
                      </span>
                      {!compareDiff.some((line) => line.type !== 'context') && (
                        <span className="diff-no-changes">
                          {locale.portfolioEditor.noDifferences || 'No differences found.'}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="diff-lines">
                    {compareDiff.map((line, index) => (
                      <div key={`${line.type}-${index}`} className={`diff-line ${line.type}`}>
                        <span className="diff-ln diff-ln-left">
                          {line.leftLine ?? ''}
                        </span>
                        <span className="diff-ln diff-ln-right">
                          {line.rightLine ?? ''}
                        </span>
                        <span className="diff-marker">
                          {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                        </span>
                        <span className="diff-content">{line.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="compare-modal-backdrop" onClick={() => setShowCompareOverlay(false)}></div>
          </div>
        )}
        {showAiOverlay && (
          <div className="ai-overlay">
            <div className="ai-modal">
              <div className="ai-modal-header">
                <h2>{locale.portfolioEditor.tryAi || 'Try AI'}</h2>
                <button
                  className="ai-modal-close"
                  onClick={() => setShowAiOverlay(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="ai-modal-body">
                <div className="ai-form">
                  <div className="ai-field">
                    <label>{locale.portfolioEditor.aiSelectArea || 'Select Area to Modify'}</label>
                    <select
                      value={aiArea}
                      onChange={(e) => {
                        setAiArea(e.target.value);
                        setAiError(null);
                      }}
                    >
                      <option value="">{locale.portfolioEditor.aiChooseArea || 'Choose an area...'}</option>
                      <option value="Languages">Languages</option>
                      <option value="Menu">Menu</option>
                      <option value="Footer">Footer</option>
                      <option value="Showcase Pages">Showcase Pages</option>
                      <option value="Theme">Theme</option>
                      <option value="Home Page">Home Page</option>
                      <option value="About Me Page">About Me Page</option>
                      <option value="Engagements Page">Engagements Page</option>
                      <option value="Specialties Page">Specialties Page</option>
                    </select>
                  </div>

                  <div className="ai-field">
                    <label>{locale.portfolioEditor.aiDescribeChange || 'Describe what you want to change'}</label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => {
                        setAiPrompt(e.target.value);
                        setAiError(null);
                      }}
                      placeholder={locale.portfolioEditor.aiPromptPlaceholder || 'E.g., Change the footer text to include social media links...'}
                      rows={5}
                    />
                  </div>

                  <div className="ai-field">
                    <label>{locale.portfolioEditor.aiSelectLanguages || 'Apply to Languages'}</label>
                    <div className="ai-language-checkboxes">
                      {languages.map((lang) => (
                        <label key={lang} className="ai-language-checkbox">
                          <input
                            type="checkbox"
                            checked={aiSelectedLanguages.includes(lang)}
                            onChange={() => toggleAiLanguage(lang)}
                          />
                          <span>{lang.toUpperCase()} - {getLanguageName(lang)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {aiError && (
                    <div className="ai-error">
                      {aiError}
                    </div>
                  )}

                  <div className="ai-actions">
                    <button
                      className="ai-submit-btn"
                      onClick={handleAiSubmit}
                      disabled={aiLoading}
                    >
                      {aiLoading
                        ? (locale.portfolioEditor.aiProcessing || 'Processing...')
                        : (locale.portfolioEditor.aiSubmit || 'Submit')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="ai-modal-backdrop" onClick={() => !aiLoading && setShowAiOverlay(false)}></div>
          </div>
        )}
        {showThemeOverlay && (
          <ThemeEditorPanel
            content={content}
            onApply={(newContent) => {
              setContent(newContent);
            }}
            onClose={() => setShowThemeOverlay(false)}
          />
        )}
        {showVersionHistory && (
          <div className={`editor-sidebar ${showVersionHistory ? 'mobile-visible' : ''}`}>
            <div className="version-history">
              <div className="version-history-header">
                <h3>{locale.portfolioEditor.versionHistory}</h3>
                <button 
                  className="mobile-close-btn"
                  onClick={() => setShowVersionHistory(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="version-list">
                {/* Live version - always first */}
                <div 
                  className={`version-item ${selectedVersionId === 'live' ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedVersionId('live');
                    if (window.innerWidth <= 768) {
                      setShowVersionHistory(false);
                    }
                  }}
                >
                  <div className="version-header">
                    <span className="version-number">Live</span>
                    <span className="version-status status-live">Current</span>
                  </div>
                  <div className="version-date">
                    {locale.portfolioEditor.currentLiveContent}
                  </div>
                </div>

                {/* All versions in descending order */}
                {versions.map((version) => (
                  <div 
                    key={version.id} 
                    className={`version-item ${selectedVersionId === version.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedVersionId(version.id);
                      if (window.innerWidth <= 768) {
                        setShowVersionHistory(false);
                      }
                    }}
                  >
                    <div className="version-header">
                      <span className="version-number">v{version.versionNumber}</span>
                      <span className={`version-status status-${getVersionStatusClass(version.status)}`}>
                        {getVersionStatusLabel(version.status, locale)}
                      </span>
                    </div>
                    {/* Show publish date (or created date) under status */}
                    <div className="version-date">
                      {version.publishedAt
                        ? new Date(version.publishedAt).toLocaleString()
                        : new Date(version.createdAt).toLocaleString()}
                    </div>
                    {version.label && (
                      <div className="version-label">
                        {version.label}
                      </div>
                    )}
                    {version.isCurrentPublished && (
                      <div className="version-badge">
                        {locale.portfolioEditor.currentPublished}
                      </div>
                    )}
                    {(version.status === VersionStatusEnum.Draft || version.status === VersionStatusEnum.Staged) && (
                      <button
                        className="version-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVersionId(version.id);
                          setTimeout(() => handleDeleteVersion(), 0);
                        }}
                        title={locale.portfolioEditor.deleteVersion}
                        aria-label={locale.portfolioEditor.deleteVersion}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="editor-main">
          {viewLoading && (
            <div className="editor-loading-overlay">
              <div className="loading-spinner"></div>
              <div className="loading-text">
                {saving ? (locale.portfolioEditor.saving || 'Saving...') : locale.portfolioEditor.loadingEditor}
              </div>
            </div>
          )}
          <div className="editor-toolbar">
            <div className="toolbar-left">
              <div className="language-dropdown-container" ref={languageDropdownRef}>
                <button 
                  className="language-selector-button"
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                >
                  <span className="lang-label">{locale.portfolioEditor.editing}</span>
                  <span className="lang-value">{currentLanguage.toUpperCase()} - {getLanguageName(currentLanguage)}</span>
                  <span className="dropdown-arrow">▼</span>
                </button>
                
                {showLanguageDropdown && (
                  <div className="language-dropdown">
                    <input
                      type="text"
                      className="language-search"
                      placeholder="Search languages..."
                      value={languageSearch}
                      onChange={(e) => setLanguageSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="language-options">
                      {getFilteredLanguages().map((lang) => {
                        const isSaved = languages.includes(lang.code);
                        return (
                          <div
                            key={lang.code}
                            className={`language-option ${currentLanguage === lang.code ? 'active' : ''} ${isSaved ? 'saved' : ''}`}
                            onClick={() => handleSelectLanguage(lang.code)}
                          >
                            <span className="lang-code">{lang.code.toUpperCase()}</span>
                            <span className="lang-name">{lang.name}</span>
                            {isSaved && <span className="checkmark">✓</span>}
                          </div>
                        );
                      })}
                      {getFilteredLanguages().length === 0 && (
                        <div className="no-results">No languages found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {hasChanges && <span className="unsaved-indicator">{locale.portfolioEditor.unsavedChanges}</span>}
              {renderSelectedVersionChip()}
            </div>
            <div className="toolbar-right">
              <button 
                onClick={handleFormatJson} 
                className="btn-format"
                disabled={isReadOnlyVersion}
              >
                {locale.portfolioEditor.formatJson}
              </button>
              
              {/* Context-aware action buttons based on selected version */}
              {selectedVersionId === 'live' && (
                <button 
                  onClick={handleSave} 
                  className="btn-save"
                  disabled={saving}
                >
                  {saving ? locale.portfolioEditor.saving : locale.portfolioEditor.save}
                </button>
              )}
              
              {selectedVersionId !== 'live' && currentVersion && currentVersion.status === VersionStatusEnum.Draft && (
                <>
                  <button 
                    onClick={handleSave} 
                    className="btn-save"
                    disabled={saving}
                  >
                    {saving ? locale.portfolioEditor.saving : locale.portfolioEditor.save}
                  </button>
                  <button 
                    onClick={handleStage} 
                    className="btn-stage"
                    disabled={saving}
                  >
                    {locale.portfolioEditor.stage}
                  </button>
                  <button 
                    onClick={handleDeleteVersion} 
                    className="btn-delete"
                    disabled={saving}
                  >
                    {locale.portfolioEditor.deleteVersion}
                  </button>
                </>
              )}
              
              {selectedVersionId !== 'live' && currentVersion && currentVersion.status === VersionStatusEnum.Staged && (
                <>
                  <button 
                    onClick={handlePublish} 
                    className="btn-publish"
                    disabled={saving}
                  >
                    {locale.portfolioEditor.publish}
                  </button>
                  <button 
                    onClick={handleDeleteVersion} 
                    className="btn-delete"
                    disabled={saving}
                  >
                    {locale.portfolioEditor.deleteVersion}
                  </button>
                </>
              )}
              
              {(selectedVersionId === 'live' || (selectedVersionId !== 'live' && currentVersion && (currentVersion.status === VersionStatusEnum.Published || currentVersion.status === VersionStatusEnum.Archived))) && (
                <button 
                  onClick={handleCopyToNewVersion} 
                  className="btn-copy"
                  disabled={saving}
                >
                  {locale.portfolioEditor.copyToNewVersion}
                </button>
              )}
            </div>
          </div>

          {isReadOnlyVersion && (
            <div className="read-only-banner">
              {locale.portfolioEditor.readOnlyBanner || 'This version is read-only. To make changes, copy to a new draft version.'}
            </div>
          )}

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

              {/* Unsaved changes banner (e.g. theme/font changes) */}
              {hasChanges && (
                <div className="unsaved-warning" role="status" aria-live="polite">
                  {locale.portfolioEditor.unsavedChangesMessage || '* some change is not yet saved'}
                </div>
              )}
            </div>
          )}

          <div className="editor-codemirror">
            <CodeMirror
              value={content}
              onChange={(value) => setContent(value || '')}
              extensions={[json()]}
              height="100%"
              className="codemirror-wrapper"
              editable={!isReadOnlyVersion}
              basicSetup={{
                lineNumbers: true,
                lineWrapping: false,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
