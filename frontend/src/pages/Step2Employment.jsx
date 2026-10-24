import React from 'react';
import { useAssessment } from './AssessmentWizard';
import styles from './AssessmentWizard.module.css';
import { useLanguage } from '../context/LanguageContext';
import CurrencyInput from '../components/CurrencyInput';
import { useNavigate } from 'react-router-dom';

const Step2Employment = ({ onNext, onPrev }) => {
  const { formData, updateData, schema } = useAssessment();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const isValid = 
    formData.employment_status !== '' &&
    formData.years_employed !== '' &&
    formData.annual_income !== null;

  return (
    <div>
      <h2 className={styles.stepTitle}>{t('s2.title')}</h2>
      <p className={styles.stepDescription}>
        {t('s2.desc')}
      </p>

      <div className={styles.grid2}>
        <div className={styles.inputGroup}>
          <label>{t('s2.status')}</label>
          <select 
            className={styles.select}
            value={formData.employment_status}
            onChange={e => updateData({ employment_status: e.target.value })}
          >
            <option value="">{t('wiz.select')}</option>
            {schema?.employment_status?.filter(opt => opt !== 'unemployed').map(opt => <option key={opt} value={opt}>{t(`opt.${opt}`)}</option>)}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>{t('s2.years')}</label>
          <input 
            type="number" 
            className={styles.input}
            value={formData.years_employed}
            onChange={e => updateData({ years_employed: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min="0"
          />
        </div>
      </div>

      <div className={styles.grid1}>
        <CurrencyInput 
          label={t('s2.income')}
          value={formData.annual_income}
          onChange={val => updateData({ annual_income: val })}
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.saveExit} onClick={() => navigate('/dashboard')}>
          {t('wiz.saveExit')}
        </button>
        <div className={styles.navButtons}>
          <button className={styles.btnSecondary} onClick={onPrev}>
            {t('wiz.back')}
          </button>
          <button className={styles.btnPrimary} onClick={onNext} disabled={!isValid}>
            {t('wiz.continue')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step2Employment;
