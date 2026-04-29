import React from 'react';

export const splitByBr = (text) => {
  if (typeof text !== 'string') return [];
  return text.split(/<br\s*\/?\s*>/gi);
};

export const renderTextWithLineBreaks = (text) => {
  const parts = splitByBr(text);
  if (parts.length === 0) return text || '';

  return parts.map((part, idx) => (
    <React.Fragment key={`line-${idx}`}>
      {part}
      {idx < parts.length - 1 && <br />}
    </React.Fragment>
  ));
};

export const hasCompleteDiagram = (showcase) => {
  const values = [
    showcase?.diagramPreTitle,
    showcase?.diagramTitle,
    showcase?.diagramSubTitle,
    showcase?.diagramImage,
  ];

  const presentCount = values.filter((value) => typeof value === 'string' && value.trim() !== '').length;
  return presentCount === values.length;
};

export const normalizeAnchorId = (numberValue, fallbackIndex) => {
  const digits = String(numberValue || '').replace(/\D/g, '');
  if (digits) {
    return `pillar${digits.padStart(2, '0')}`;
  }
  return `pillar${String(fallbackIndex + 1).padStart(2, '0')}`;
};

export const normalizePath = (rawPath, resolvePath) => {
  if (!rawPath || typeof rawPath !== 'string') return '#';
  if (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('#')) {
    return rawPath;
  }

  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return resolvePath(withLeadingSlash);
};
