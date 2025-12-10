import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconLibrary } from './fontAwesomeIcons';

/**
 * Parse strings with icon syntax like: <Icon icon='iconName' size='2xs' style='color: red;' />
 * Converts them to actual React Icon components
 * 
 * @param {string} text - The text that may contain icon syntax
 * @returns {React.ReactNode} - Parsed content with icons rendered as components
 */
export const parseIconSyntax = (text) => {
  if (!text || typeof text !== 'string') return text;

  // Regex to match <Icon icon='iconName' ... /> with multiple attributes
  const iconRegex = /<Icon\s+([^>]*?)\/>/g;
  
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = iconRegex.exec(text)) !== null) {
    // Add text before the icon
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const attrsString = match[1];
    
    // Parse attributes from the tag
    const iconMatch = attrsString.match(/icon=['"]([^'"]+)['"]/);
    const sizeMatch = attrsString.match(/size=['"]([^'"]+)['"]/);
    const styleMatch = attrsString.match(/style=['"]([^'"]+)['"]/);

    if (!iconMatch) {
      parts.push(match[0]); // No icon attribute, skip
      lastIndex = match.index + match[0].length;
      continue;
    }

    const iconName = iconMatch[1];
    const size = sizeMatch ? sizeMatch[1] : '1x';
    const styleString = styleMatch ? styleMatch[1] : '';

    // Parse style string into object
    const style = {};
    if (styleString) {
      const stylePairs = styleString.split(';').filter(s => s.trim());
      stylePairs.forEach(pair => {
        const [key, value] = pair.split(':').map(s => s.trim());
        if (key && value) {
          // Convert CSS property names to camelCase (e.g., 'background-color' -> 'backgroundColor')
          const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          style[camelKey] = value;
        }
      });
    }

    // Get the icon from the library
    const faIcon = iconLibrary[iconName];
    if (faIcon) {
      parts.push(
        <FontAwesomeIcon 
          key={`icon-${lastIndex}-${match.index}`}
          icon={faIcon}
          size={size}
          style={style}
        />
      );
    } else {
      // Icon not found, just render the original text
      console.warn(`Icon "${iconName}" not found in icon library`);
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length === 0 ? text : parts;
};

export default parseIconSyntax;
