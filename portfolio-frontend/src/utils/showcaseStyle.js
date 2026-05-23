export const SHOWCASE_STYLE = {
  CAROUSEL: 'carousel',
  PILLARS: 'pillars',
};

const normalizeStyle = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const hasLegacyPillarsSignals = (showcase) =>
  Array.isArray(showcase?.pillarButtons) && showcase.pillarButtons.length > 0;

export const getShowcaseStyle = (showcase) => {
  const explicitStyle = normalizeStyle(showcase?.style);

  if (explicitStyle === SHOWCASE_STYLE.CAROUSEL || explicitStyle === SHOWCASE_STYLE.PILLARS) {
    return explicitStyle;
  }

  if (hasLegacyPillarsSignals(showcase)) {
    return SHOWCASE_STYLE.PILLARS;
  }

  return SHOWCASE_STYLE.CAROUSEL;
};

export const isPillarsStyle = (showcase) => getShowcaseStyle(showcase) === SHOWCASE_STYLE.PILLARS;
