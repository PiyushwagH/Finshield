import React, { useState, useEffect } from 'react';
import styles from './CurrencyInput.module.css';
import InfoTooltip from './InfoTooltip';

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
        <InfoTooltip text={tooltip} />
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
