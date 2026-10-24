import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import styles from './HelpCenter.module.css';

const HelpCenter = () => {
  const { t } = useLanguage();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('help.title')}</h1>
        <p className={styles.subtitle}>{t('help.subtitle')}</p>
      </div>

      <div className={styles.section}>
        <h3 className={styles.question}>{t('help.q1')}</h3>
        <p className={styles.answer}>{t('help.a1')}</p>

        <h3 className={styles.question}>{t('help.q2')}</h3>
        <p className={styles.answer}>{t('help.a2')}</p>

        <h3 className={styles.question}>{t('help.q3')}</h3>
        <p className={styles.answer}>{t('help.a3')}</p>

        <h3 className={styles.question}>{t('help.q4')}</h3>
        <p className={styles.answer}>
          {t('help.a4Pre')}<Link to="/settings">{t('nav.settings')}</Link>{t('help.a4Post')}
        </p>

        <h3 className={styles.question}>{t('help.q5')}</h3>
        <p className={styles.answer}>
          {t('help.a5Pre')}<Link to="/security-log">{t('nav.securityLog')}</Link>{t('help.a5Post')}
        </p>

        <h3 className={styles.question}>{t('help.q6')}</h3>
        <p className={styles.answer}>
          {t('help.a6Pre')}<Link to="/expenses">{t('nav.expenses')}</Link>{t('help.a6Post')}
        </p>
      </div>

      <div className={styles.section}>
        <h3 className={styles.question}>{t('help.stillTitle')}</h3>
        <p className={styles.answer}>{t('help.stillText')}</p>
      </div>
    </div>
  );
};

export default HelpCenter;
