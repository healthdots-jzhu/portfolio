import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import './LoadingSpinner.css';

/**
 * Animated loading spinner using Font Awesome's faCircleNotch with the built-in spin prop.
 *
 * @param {string}  label      - Optional text shown below the icon.
 * @param {string}  size       - FontAwesome size token e.g. '2x', '3x' (default: '2x').
 * @param {string}  className  - Extra class names on the wrapper.
 */
export default function LoadingSpinner({ label, size = '2x', className = '', fullscreen = false }) {
  const wrapperClass = `loading-spinner-wrapper ${className} ${fullscreen ? 'loading-spinner-fullscreen' : ''}`.trim();

  return (
    <div className={wrapperClass}>
      <FontAwesomeIcon icon={faCircleNotch} spin size={size} className="loading-spinner-icon" />
      {label && <span className="loading-spinner-label">{label}</span>}
    </div>
  );
}
