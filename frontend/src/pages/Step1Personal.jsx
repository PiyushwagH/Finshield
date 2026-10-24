import React from 'react';
import { useAssessment } from './AssessmentWizard';
import styles from './AssessmentWizard.module.css';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';

const Step1Personal = ({ onNext }) => {
  const { formData, updateData, schema } = useAssessment();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const isValid = 
    formData.age !== '' &&
    formData.gender !== '' &&
    formData.education !== '' &&
    formData.marital_status !== '' &&
    formData.dependents !== '';

  return (
    <div>
      <h2 className={styles.stepTitle}>{t('s1.title')}</h2>
      <p className={styles.stepDescription}>
        {t('s1.desc')}
      </p>

      <div className={styles.grid2}>
        <div className={styles.inputGroup}>
          <label>{t('s1.age')}</label>
          <input 
            type="number" 
            className={styles.input}
            value={formData.age}
            onChange={e => updateData({ age: e.target.value ? parseInt(e.target.value) : '' })}
            placeholder={t('s1.agePlaceholder')}
          />
        </div>

        <div className={styles.inputGroup}>
          <label>{t('s1.gender')}</label>
          <select 
            className={styles.select}
            value={formData.gender}
            onChange={e => updateData({ gender: e.target.value })}
          >
            <option value="">{t('wiz.select')}</option>
            {schema?.gender?.map(opt => <option key={opt} value={opt}>{t(`opt.${opt}`)}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.grid1}>
        <div className={styles.inputGroup}>
          <label>{t('s1.education')}</label>
          <select 
            className={styles.select}
            value={formData.education}
            onChange={e => updateData({ education: e.target.value })}
          >
            <option value="">{t('wiz.select')}</option>
            {schema?.education?.map(opt => <option key={opt} value={opt}>{t(`opt.${opt}`)}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.inputGroup}>
          <label>{t('s1.marital')}</label>
          <select 
            className={styles.select}
            value={formData.marital_status}
            onChange={e => updateData({ marital_status: e.target.value })}
          >
            <option value="">{t('wiz.select')}</option>
            {schema?.marital_status?.map(opt => <option key={opt} value={opt}>{t(`opt.${opt}`)}</option>)}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>{t('s1.dependents')}</label>
          <input 
            type="number" 
            className={styles.input}
            value={formData.dependents}
            onChange={e => updateData({ dependents: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min="0"
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.saveExit} onClick={() => navigate('/dashboard')}>
          {t('wiz.saveExit')}
        </button>
        <div className={styles.navButtons}>
          <button className={styles.btnPrimary} onClick={onNext} disabled={!isValid}>
            {t('wiz.continue')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step1Personal;
