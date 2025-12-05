import React from 'react';

/**
 * Parse text with color tags and return React elements with proper styling
 * Supports nested tags where inner tags take precedence
 * Example: <color:#7fb685>green text</color>
 * Example: <color:#994122>red with <color:#7fb685>green override</color> back to red</color>
 */
export const parseColorTags = (text) => {
  if (!text || typeof text !== 'string') return text;

  const elements = [];
  let currentIndex = 0;
  let keyCounter = 0;

  // Regex to match color tags: <color:#hexcode>content</color>
  const colorTagRegex = /<color:(#[0-9a-fA-F]{6})>(.*?)<\/color>/g;

  const processText = (str, defaultColor = null) => {
    const parts = [];
    let lastIndex = 0;
    let match;

    // Create a new regex instance for this processing
    const regex = new RegExp(colorTagRegex.source, colorTagRegex.flags);

    while ((match = regex.exec(str)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textBefore = str.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push({
            type: 'text',
            content: textBefore,
            color: defaultColor,
            key: keyCounter++
          });
        }
      }

      // Add the colored text (recursively process in case of nested tags)
      const color = match[1];
      const content = match[2];
      
      // Recursively process the content for nested tags
      const nestedParts = processText(content, color);
      parts.push(...nestedParts);

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after last match
    if (lastIndex < str.length) {
      const remainingText = str.substring(lastIndex);
      if (remainingText) {
        parts.push({
          type: 'text',
          content: remainingText,
          color: defaultColor,
          key: keyCounter++
        });
      }
    }

    // If no matches found, return the whole string as one part
    if (parts.length === 0) {
      parts.push({
        type: 'text',
        content: str,
        color: defaultColor,
        key: keyCounter++
      });
    }

    return parts;
  };

  const parts = processText(text);

  // Convert parts to React elements
  return parts.map(part => {
    if (part.color) {
      return <span key={part.key} style={{ color: part.color }}>{part.content}</span>;
    }
    return part.content;
  });
};
