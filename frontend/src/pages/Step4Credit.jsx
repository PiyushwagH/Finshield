import React from 'react';
import { useAssessment } from './AssessmentWizard';
import styles from './AssessmentWizard.module.css';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import InfoTooltip from '../components/InfoTooltip';

const Step4Credit = ({ onSubmit, onPrev, submitting }) => {
  const { formData, updateData, schema } = useAssessment();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const isCreditFieldsValid = 
    formData.n_prior_credits !== '' &&
    formData.n_active_credits !== '' &&
    formData.years_credit_history !== '' &&
    formData.payment_history !== '';

  const isValid = !formData.has_prior_credit || isCreditFieldsValid;

  return (
    <div>
      <h2 className={styles.stepTitle}>{t('s4.title')}</h2>
      <p className={styles.stepDescription}>
        {t('s4.desc')}
      </p>

      <div className={styles.toggleGroup}>
        <div className={styles.toggleLabel}>
          {t('s4.prior')}
          <InfoTooltip text={t('s4.priorTip')} />
        </div>
        <label className={styles.switch}>
          <input 
            type="checkbox" 
            checked={formData.has_prior_credit} 
            onChange={e => updateData({ has_prior_credit: e.target.checked })} 
          />
          <span className={styles.slider}></span>
        </label>
      </div>

      {formData.has_prior_credit && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className={styles.grid2}>
            <div className={styles.inputGroup}>
              <label>{t('s4.nPrior')}</label>
              <input 
                type="number" 
                className={styles.input}
                value={formData.n_prior_credits}
                onChange={e => updateData({ n_prior_credits: e.target.value === '' ? '' : parseInt(e.target.value) })}
                min="0"
              />
            </div>

            <div className={styles.inputGroup}>
              <label>{t('s4.nActive')}</label>
              <input 
                type="number" 
                className={styles.input}
                value={formData.n_active_credits}
                onChange={e => updateData({ n_active_credits: e.target.value === '' ? '' : parseInt(e.target.value) })}
                min="0"
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.inputGroup}>
              <label>{t('s4.years')}</label>
              <input 
                type="number" 
                className={styles.input}
                value={formData.years_credit_history}
                onChange={e => updateData({ years_credit_history: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                step="0.1"
                min="0"
              />
            </div>

            <div className={styles.inputGroup}>
              <label>{t('s4.rating')}</label>
              <select 
                className={styles.select}
                value={formData.payment_history}
                onChange={e => updateData({ payment_history: e.target.value })}
              >
                <option value="">{t('wiz.select')}</option>
                {schema?.payment_history?.map(opt => <option key={opt} value={opt}>{t(`opt.${opt}`)}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.toggleGroup}>
            <div className={styles.toggleLabel}>
              {t('s4.defaulted')}
            </div>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={formData.has_defaulted} 
                onChange={e => updateData({ has_defaulted: e.target.checked })} 
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.saveExit} onClick={() => navigate('/dashboard')} disabled={submitting}>
          {t('wiz.saveExit')}
        </button>
        <div className={styles.navButtons}>
          <button className={styles.btnSecondary} onClick={onPrev} disabled={submitting}>
            {t('wiz.back')}
          </button>
          <button className={styles.btnPrimary} onClick={onSubmit} disabled={!isValid || submitting}>
            {submitting ? t('wiz.submitting') : t('wiz.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step4Credit;
