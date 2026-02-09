/**
 * Version Status Enum
 * Maps to backend VersionStatus enum values
 */
export const VersionStatusEnum = {
  Draft: 0,
  Staged: 1,
  Published: 2,
  Archived: 3
};

/**
 * Reverse mapping: number to status name
 */
export const VersionStatusNames = {
  0: 'Draft',
  1: 'Staged',
  2: 'Published',
  3: 'Archived'
};

/**
 * Get localized version status label
 * @param {number|string} statusValue - Status value from API (0-3 or 'Draft', 'Staged', 'Published', 'Archived')
 * @param {object} locale - Locale object from useAppLocale hook
 * @returns {string} - Localized status label
 */
export const getVersionStatusLabel = (statusValue, locale) => {
  // Normalize to status name (handle both number and string inputs)
  let statusName;
  
  if (typeof statusValue === 'number') {
    statusName = VersionStatusNames[statusValue];
  } else if (typeof statusValue === 'string') {
    statusName = statusValue;
  }

  if (!statusName) {
    console.warn(`Unknown version status: ${statusValue}`);
    return statusValue;
  }

  // Map status name to locale key
  const statusKeyMap = {
    'Draft': 'portfolioEditor.draft',
    'Staged': 'portfolioEditor.staged',
    'Published': 'portfolioEditor.published',
    'Archived': 'portfolioEditor.archived'
  };

  const key = statusKeyMap[statusName];
  if (!key || !locale) {
    return statusName;
  }

  // Navigate through locale object using dot notation
  const keys = key.split('.');
  let value = locale;
  for (const k of keys) {
    value = value?.[k];
  }

  return value || statusName;
};

/**
 * Get CSS class name for version status styling
 * @param {number|string} statusValue - Status value
 * @returns {string} - CSS class name suffix
 */
export const getVersionStatusClass = (statusValue) => {
  let statusName;
  
  if (typeof statusValue === 'number') {
    statusName = VersionStatusNames[statusValue];
  } else {
    statusName = statusValue;
  }

  return statusName ? statusName.toLowerCase() : 'unknown';
};
