import React from 'react';
import { useAssessment } from './AssessmentWizard';
import styles from './AssessmentWizard.module.css';
import CurrencyInput from '../components/CurrencyInput';
import { useNavigate } from 'react-router-dom';

const Step2Employment = ({ onNext, onPrev }) => {
  const { formData, updateData, schema } = useAssessment();
  const navigate = useNavigate();

  const isValid = 
    formData.employment_status !== '' &&
    formData.years_employed !== '' &&
    formData.annual_income !== null;

  return (
    <div>
      <h2 className={styles.stepTitle}>Employment Details</h2>
      <p className={styles.stepDescription}>
        Tell us about your current employment and income sources.
      </p>

      <div className={styles.grid2}>
        <div className={styles.inputGroup}>
          <label>Employment Status</label>
          <select 
            className={styles.select}
            value={formData.employment_status}
            onChange={e => updateData({ employment_status: e.target.value })}
          >
            <option value="">Select Status</option>
            {schema?.employment_status?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>Years Employed</label>
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
          label="Total Annual Income"
          value={formData.annual_income}
          onChange={val => updateData({ annual_income: val })}
        />
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

export default Step2Employment;
