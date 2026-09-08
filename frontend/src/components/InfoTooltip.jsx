import React from 'react';
import styles from './InfoTooltip.module.css';

// Replaces the native `title` attribute, which only appears after a
// browser-controlled delay (and not at all on touch devices). This shows
// immediately on hover and also on keyboard focus, so it's reachable
// without a mouse.
const InfoTooltip = ({ text }) => {
  if (!text) return null;

  return (
    <span className={styles.wrapper} tabIndex={0}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span className={styles.bubble} role="tooltip">{text}</span>
    </span>
  );
};

export default InfoTooltip;
