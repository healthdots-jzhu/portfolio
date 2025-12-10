import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * Simple wrapper component for FontAwesomeIcon
 * Makes it easy to use icons throughout the app
 * 
 * @param {string} icon - Icon name from iconLibrary (e.g., 'home', 'code', 'github')
 * @param {string} size - Size: 'xs', 'sm', 'lg', '1x', '2x', etc.
 * @param {string} className - Additional CSS classes
 * @param {object} style - Inline styles
 * @param {string} title - Title attribute for accessibility
 * @param {...props} props - Any other FontAwesomeIcon props
 */
export const Icon = ({ 
  icon, 
  size = '1x', 
  className = '', 
  style = {}, 
  title = '',
  ...props 
}) => {
  const { default: iconLibrary } = require('./fontAwesomeIcons');
  
  if (!iconLibrary[icon]) {
    console.warn(`Icon "${icon}" not found in icon library`);
    return null;
  }

  return (
    <FontAwesomeIcon 
      icon={iconLibrary[icon]}
      size={size}
      className={className}
      style={style}
      title={title}
      {...props}
    />
  );
};

export default Icon;
