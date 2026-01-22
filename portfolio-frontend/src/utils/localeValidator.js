/**
 * Frontend locale content validator
 * Validates JSON structure and required fields before saving
 */

/**
 * Validate locale content structure
 * @param {string} contentJson - JSON string to validate
 * @param {string} language - Language code (en, fr, zh)
 * @returns {Object} Validation result with errors and warnings
 */
export function validateLocaleContent(contentJson, language) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Step 1: Handle empty/blank content - treat as empty object
  if (!contentJson || contentJson.trim() === '') {
    return result; // Empty content is valid - will be removed from backend
  }

  // Step 2: Check if content is serializable JSON
  let content;
  try {
    content = JSON.parse(contentJson);
  } catch (error) {
    result.isValid = false;
    result.errors.push({
      field: 'root',
      message: `Invalid JSON format: ${error.message}`,
      severity: 'Error',
    });
    return result;
  }

  // Step 3: Validate content is an object
  if (typeof content !== 'object' || content === null || Array.isArray(content)) {
    result.isValid = false;
    result.errors.push({
      field: 'root',
      message: 'Content must be a JSON object',
      severity: 'Error',
    });
    return result;
  }

  // Step 4: Allow empty objects (clearing a locale is valid)
  if (Object.keys(content).length === 0) {
    return result;
  }

  // Step 5: Validate array fields are actually arrays (if present)
  const arrayFields = ['sections', 'socialLinks', 'projects'];
  
  for (const field of arrayFields) {
    if (field in content) {
      if (!Array.isArray(content[field])) {
        result.isValid = false;
        result.errors.push({
          field,
          message: `Field '${field}' must be an array`,
          severity: 'Error',
        });
      }
    }
  }

  // Step 6: Validate sections structure if present
  if (Array.isArray(content.sections)) {
    content.sections.forEach((section, index) => {
      if (typeof section !== 'object' || section === null) {
        result.errors.push({
          field: `sections[${index}]`,
          message: 'Section must be an object',
          severity: 'Error',
        });
        result.isValid = false;
      }
    });
  }

  // Step 7: Validate social links structure if present
  if (Array.isArray(content.socialLinks)) {
    content.socialLinks.forEach((link, index) => {
      if (typeof link !== 'object' || link === null) {
        result.warnings.push({
          field: `socialLinks[${index}]`,
          message: 'Social link must be an object',
        });
      } else if (link.url && typeof link.url === 'string' && !isValidUrl(link.url)) {
        result.warnings.push({
          field: `socialLinks[${index}].url`,
          message: 'URL may not be valid',
        });
      }
    });
  }

  // Step 8: Validate resume link if present
  if ('resumeLink' in content && content.resumeLink) {
    if (typeof content.resumeLink !== 'string') {
      result.warnings.push({
        field: 'resumeLink',
        message: 'Resume link should be a string',
      });
    } else if (!isValidUrl(content.resumeLink)) {
      result.warnings.push({
        field: 'resumeLink',
        message: 'Resume link may not be a valid URL',
      });
    }
  }

  return result;
}

/**
 * Check if a string is a valid URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
