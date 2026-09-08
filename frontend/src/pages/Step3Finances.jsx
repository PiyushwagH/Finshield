import React from 'react';
import { useAssessment } from './AssessmentWizard';
import styles from './AssessmentWizard.module.css';
import CurrencyInput from '../components/CurrencyInput';
import InfoTooltip from '../components/InfoTooltip';
import { useNavigate } from 'react-router-dom';

const Step3Finances = ({ onNext, onPrev }) => {
  const { formData, updateData } = useAssessment();
  const navigate = useNavigate();

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
      <h2 className={styles.stepTitle}>Existing Financial Situation</h2>
      <p className={styles.stepDescription}>
        Please provide accurate details regarding your current financial standing. All amounts should be in INR (₹).
      </p>

      <div className={styles.toggleGroup}>
        <div className={styles.toggleLabel}>
          Do you have any active loans or EMIs?
          <InfoTooltip text="Any ongoing home, vehicle, personal, or other loan with monthly payments." />
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
            label="Total Monthly EMIs"
            value={formData.monthly_emi}
            onChange={val => updateData({ monthly_emi: val })}
            tooltip="Total of all your current monthly loan or credit card payments."
          />
          <CurrencyInput
            label="Total Outstanding Loan Balance"
            value={formData.existing_total_debt}
            onChange={val => updateData({ existing_total_debt: val })}
            tooltip="Total remaining principal on all your loans."
          />
        </div>
      )}

      <div className={styles.grid2} style={{ marginTop: '1.5rem' }}>
        <CurrencyInput
          label="Approximate Total Asset Value"
          value={formData.asset_value}
          onChange={val => updateData({ asset_value: val })}
          tooltip="Estimated value of property, investments, and other liquid assets."
        />
        <CurrencyInput
          label="Avg Monthly Household Expenditure"
          value={formData.monthly_expenditure}
          onChange={val => updateData({ monthly_expenditure: val })}
          tooltip="Average monthly expenses excluding EMIs."
        />
      </div>

      <div className={styles.grid1}>
        <CurrencyInput
          label="Current Savings and Emergency Fund"
          value={formData.savings}
          onChange={val => updateData({ savings: val })}
          tooltip="Total amount in savings accounts and liquid emergency funds."
        />
      </div>

      <div className={styles.toggleGroup}>
        <div className={styles.toggleLabel}>
          Do you own a vehicle?
          <InfoTooltip text="Includes cars, two-wheelers, etc." />
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
          Do you own property?
          <InfoTooltip text="Includes houses, land, commercial property." />
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
          Save and Exit
        </button>
        <div className={styles.navButtons}>
          <button className={styles.btnSecondary} onClick={onPrev}>
            Back
          </button>
          <button className={styles.btnPrimary} onClick={onNext} disabled={!isValid}>
            Continue &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step3Finances;
