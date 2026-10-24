import React from 'react';
import { useAssessment } from './AssessmentWizard';
import styles from './AssessmentWizard.module.css';
import { useLanguage } from '../context/LanguageContext';
import CurrencyInput from '../components/CurrencyInput';
import InfoTooltip from '../components/InfoTooltip';
import { useNavigate } from 'react-router-dom';

const Step3Finances = ({ onNext, onPrev }) => {
  const { formData, updateData } = useAssessment();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // EMI and outstanding balance are only meaningful when the user actually
  // has a loan running, so they're gated behind that toggle - same pattern
  // as "prior credit history" on the next step. When toggled off they are
  // zeroed rather than left blank, since 0 is what "no loan" means to the
  // risk model.
  const handleActiveLoansToggle = (checked) => {
    updateData(
      checked
        ? { has_active_loans: true }
        : { has_active_loans: false, monthly_emi: 0, existing_total_debt: 0 }
    );
  };

  const isValid =
    (!formData.has_active_loans ||
      (formData.monthly_emi !== null && formData.existing_total_debt !== null)) &&
    formData.asset_value !== null &&
    formData.monthly_expenditure !== null &&
    formData.savings !== null;

  return (
    <div>
      <h2 className={styles.stepTitle}>{t('s3.title')}</h2>
      <p className={styles.stepDescription}>
        {t('s3.desc')}
      </p>

      <div className={styles.toggleGroup}>
        <div className={styles.toggleLabel}>
          {t('s3.activeLoans')}
          <InfoTooltip text={t('s3.activeLoansTip')} />
        </div>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={formData.has_active_loans}
            onChange={e => handleActiveLoansToggle(e.target.checked)}
          />
          <span className={styles.slider}></span>
        </label>
      </div>

      {formData.has_active_loans && (
        <div className={styles.grid2} style={{ marginTop: '1.5rem' }}>
          <CurrencyInput
            label={t('s3.emi')}
            value={formData.monthly_emi}
            onChange={val => updateData({ monthly_emi: val })}
            tooltip={t('s3.emiTip')}
          />
          <CurrencyInput
            label={t('s3.debt')}
            value={formData.existing_total_debt}
            onChange={val => updateData({ existing_total_debt: val })}
            tooltip={t('s3.debtTip')}
          />
        </div>
      )}

      <div className={styles.grid2} style={{ marginTop: '1.5rem' }}>
        <CurrencyInput
          label={t('s3.assets')}
          value={formData.asset_value}
          onChange={val => updateData({ asset_value: val })}
          tooltip={t('s3.assetsTip')}
        />
        <CurrencyInput
          label={t('s3.expenditure')}
          value={formData.monthly_expenditure}
          onChange={val => updateData({ monthly_expenditure: val })}
          tooltip={t('s3.expenditureTip')}
        />
      </div>

      <div className={styles.grid1}>
        <CurrencyInput
          label={t('s3.savings')}
          value={formData.savings}
          onChange={val => updateData({ savings: val })}
          tooltip={t('s3.savingsTip')}
        />
      </div>

      <div className={styles.toggleGroup}>
        <div className={styles.toggleLabel}>
          {t('s3.vehicle')}
          <InfoTooltip text={t('s3.vehicleTip')} />
        </div>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={formData.owns_vehicle}
            onChange={e => updateData({ owns_vehicle: e.target.checked })}
          />
          <span className={styles.slider}></span>
        </label>
      </div>

      <div className={styles.toggleGroup}>
        <div className={styles.toggleLabel}>
          {t('s3.property')}
          <InfoTooltip text={t('s3.propertyTip')} />
        </div>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={formData.owns_property}
            onChange={e => updateData({ owns_property: e.target.checked })}
          />
          <span className={styles.slider}></span>
        </label>
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

export default Step3Finances;
