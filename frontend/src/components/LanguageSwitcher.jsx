import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import styles from './LanguageSwitcher.module.css';

const LanguageSwitcher = ({ className = '' }) => {
  const { lang, setLang, t } = useLanguage();
  return (
    <select
      className={`${styles.select} ${className}`}
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label={t('common.language')}
    >
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
      <option value="mr">मराठी</option>
    </select>
  );
};

export default LanguageSwitcher;
