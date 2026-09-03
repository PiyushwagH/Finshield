import React, { useState, useEffect } from 'react';
import styles from './CurrencyInput.module.css';

const formatIndianCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const numStr = value.toString().replace(/,/g, '');
  if (isNaN(numStr)) return '';
  
  // Format according to Indian grouping (e.g. 9,00,000)
  let lastThree = numStr.substring(numStr.length - 3);
  const otherNumbers = numStr.substring(0, numStr.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
};

const CurrencyInput = ({ value, onChange, label, tooltip, error }) => {
  const [displayValue, setDisplayValue] = useState(formatIndianCurrency(value));

  useEffect(() => {
    setDisplayValue(formatIndianCurrency(value));
  }, [value]);

  const handleChange = (e) => {
    // Remove all non-digits
    const rawVal = e.target.value.replace(/\D/g, '');
    
    // Update display (for smooth typing experience)
    setDisplayValue(formatIndianCurrency(rawVal));
    
    // Send number to parent
    onChange(rawVal === '' ? null : parseInt(rawVal, 10));
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>
        {label}
        {tooltip && (
          <span className={styles.tooltipIcon} title={tooltip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </span>
        )}
      </label>
      <div className={`${styles.inputContainer} ${error ? styles.error : ''}`}>
        <span className={styles.prefix}>₹</span>
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          className={styles.input}
          placeholder="0"
        />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};

export default CurrencyInput;
