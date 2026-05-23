/**
 * Frontend locale content validator
 * Validates JSON structure and required fields before saving
 */
import { getShowcaseStyle, SHOWCASE_STYLE } from './showcaseStyle.js';

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

  // Step 9: Validate showcases structure if present under common.showcases
  const showcases = content?.common?.showcases;
  if (showcases !== undefined) {
    if (!Array.isArray(showcases)) {
      result.isValid = false;
      result.errors.push({
        field: 'common.showcases',
        message: "Field 'common.showcases' must be an array",
        severity: 'Error',
      });
    } else {
      showcases.forEach((showcase, showcaseIndex) => {
        validateShowcase(showcase, showcaseIndex, result);
      });
    }
  }

  return result;
}

function validateShowcase(showcase, showcaseIndex, result) {
  const showcaseField = `common.showcases[${showcaseIndex}]`;

  if (typeof showcase !== 'object' || showcase === null || Array.isArray(showcase)) {
    result.isValid = false;
    result.errors.push({
      field: showcaseField,
      message: 'Showcase must be an object',
      severity: 'Error',
    });
    return;
  }

  const styleValue = String(showcase.style || '').trim().toLowerCase();
  if (styleValue && styleValue !== SHOWCASE_STYLE.CAROUSEL && styleValue !== SHOWCASE_STYLE.PILLARS) {
    addValidationError(
      result,
      `${showcaseField}.style`,
      "'style' must be either 'carousel' or 'pillars' when provided"
    );
  }

  const pillarsMode = getShowcaseStyle(showcase) === SHOWCASE_STYLE.PILLARS;
  if (!pillarsMode) {
    return;
  }

  if (!isNonEmptyString(showcase.title)) {
    addValidationError(result, `${showcaseField}.title`, "Pillars Style requires non-empty 'title'");
  }

  if (!isNonEmptyString(showcase.subtitle)) {
    addValidationError(result, `${showcaseField}.subtitle`, "Pillars Style requires non-empty 'subtitle'");
  }

  if (!Array.isArray(showcase.pillars) || showcase.pillars.length === 0) {
    addValidationError(result, `${showcaseField}.pillars`, "Pillars Style requires non-empty 'pillars' array");
  }

  const diagramFields = [
    'diagramPreTitle',
    'diagramTitle',
    'diagramSubTitle',
    'diagramImage',
  ];
  const diagramPresentCount = diagramFields.filter((field) => isNonEmptyString(showcase[field])).length;
  if (diagramPresentCount > 0 && diagramPresentCount < diagramFields.length) {
    addValidationError(
      result,
      `${showcaseField}.diagram*`,
      "'diagramPreTitle', 'diagramTitle', 'diagramSubTitle', and 'diagramImage' must either all be present or all be omitted"
    );
  }

  if (diagramPresentCount === diagramFields.length && !isValidMediaPath(showcase.diagramImage)) {
    addValidationError(result, `${showcaseField}.diagramImage`, "'diagramImage' must be an http(s) URL or start with '/img/'");
  }

  showcase.pillarButtons.forEach((button, buttonIndex) => {
    const buttonField = `${showcaseField}.pillarButtons[${buttonIndex}]`;
    if (typeof button !== 'object' || button === null || Array.isArray(button)) {
      addValidationError(result, buttonField, 'Pillar button must be an object');
      return;
    }
    if (!isNonEmptyString(button.name)) {
      addValidationError(result, `${buttonField}.name`, "Pillar button requires non-empty 'name'");
    }
    if (!isNonEmptyString(button.path)) {
      addValidationError(result, `${buttonField}.path`, "Pillar button requires non-empty 'path'");
    }
  });

  if (Array.isArray(showcase.pillars)) {
    showcase.pillars.forEach((pillar, pillarIndex) => {
      const pillarField = `${showcaseField}.pillars[${pillarIndex}]`;
      if (typeof pillar !== 'object' || pillar === null || Array.isArray(pillar)) {
        addValidationError(result, pillarField, 'Pillar must be an object');
        return;
      }

      ['number', 'label', 'title', 'subTitle', 'description', 'tools'].forEach((fieldName) => {
        if (!isNonEmptyString(pillar[fieldName])) {
          addValidationError(result, `${pillarField}.${fieldName}`, `Pillar requires non-empty '${fieldName}'`);
        }
      });

      if (!Array.isArray(pillar.bullets) || pillar.bullets.length === 0) {
        addValidationError(result, `${pillarField}.bullets`, "Pillar requires non-empty 'bullets' array");
      } else {
        pillar.bullets.forEach((bullet, bulletIndex) => {
          const bulletField = `${pillarField}.bullets[${bulletIndex}]`;
          if (typeof bullet !== 'object' || bullet === null || Array.isArray(bullet)) {
            addValidationError(result, bulletField, 'Bullet must be an object');
            return;
          }
          if (!isNonEmptyString(bullet.title)) {
            addValidationError(result, `${bulletField}.title`, "Bullet requires non-empty 'title'");
          }
          if (!isNonEmptyString(bullet.description)) {
            addValidationError(result, `${bulletField}.description`, "Bullet requires non-empty 'description'");
          }
        });
      }
    });
  }

  if (showcase.coreSkills !== undefined) {
    if (typeof showcase.coreSkills !== 'object' || showcase.coreSkills === null || Array.isArray(showcase.coreSkills)) {
      addValidationError(result, `${showcaseField}.coreSkills`, 'coreSkills must be an object');
      return;
    }

    if (!Array.isArray(showcase.coreSkills.rows)) {
      addValidationError(result, `${showcaseField}.coreSkills.rows`, 'coreSkills.rows must be an array of arrays');
    } else {
      showcase.coreSkills.rows.forEach((row, rowIndex) => {
        if (!Array.isArray(row)) {
          addValidationError(result, `${showcaseField}.coreSkills.rows[${rowIndex}]`, 'Each coreSkills row must be an array');
          return;
        }
        row.forEach((item, itemIndex) => {
          if (!isNonEmptyString(item)) {
            addValidationError(result, `${showcaseField}.coreSkills.rows[${rowIndex}][${itemIndex}]`, 'Each core skill value must be a non-empty string');
          }
        });
      });
    }
  }
}

function addValidationError(result, field, message) {
  result.isValid = false;
  result.errors.push({
    field,
    message,
    severity: 'Error',
  });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isValidMediaPath(value) {
  if (!isNonEmptyString(value)) return false;
  return value.startsWith('/img/') || value.startsWith('http://') || value.startsWith('https://');
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
