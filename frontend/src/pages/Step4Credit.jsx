import React from 'react';
import { useAssessment } from './AssessmentWizard';
import styles from './AssessmentWizard.module.css';
import { useNavigate } from 'react-router-dom';
import InfoTooltip from '../components/InfoTooltip';

const Step4Credit = ({ onSubmit, onPrev, submitting }) => {
  const { formData, updateData, schema } = useAssessment();
  const navigate = useNavigate();

  const isCreditFieldsValid = 
    formData.n_prior_credits !== '' &&
    formData.n_active_credits !== '' &&
    formData.years_credit_history !== '' &&
    formData.payment_history !== '';

  const isValid = !formData.has_prior_credit || isCreditFieldsValid;

  return (
    <div>
      <h2 className={styles.stepTitle}>Credit History</h2>
      <p className={styles.stepDescription}>
        Let's review your credit background to finalize the assessment.
      </p>

      <div className={styles.toggleGroup}>
        <div className={styles.toggleLabel}>
          Do you have prior credit history?
          <InfoTooltip text="Any previous loans or credit cards." />
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
              <label>Number of Prior Credits</label>
              <input 
                type="number" 
                className={styles.input}
                value={formData.n_prior_credits}
                onChange={e => updateData({ n_prior_credits: e.target.value === '' ? '' : parseInt(e.target.value) })}
                min="0"
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Number of Active Credits</label>
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
              <label>Years of Credit History</label>
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
              <label>Payment History Rating</label>
              <select 
                className={styles.select}
                value={formData.payment_history}
                onChange={e => updateData({ payment_history: e.target.value })}
              >
                <option value="">Select Rating</option>
                {schema?.payment_history?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.toggleGroup}>
            <div className={styles.toggleLabel}>
              Have you ever defaulted on a loan?
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
          Save and Exit
        </button>
        <div className={styles.navButtons}>
          <button className={styles.btnSecondary} onClick={onPrev} disabled={submitting}>
            Back
          </button>
          <button className={styles.btnPrimary} onClick={onSubmit} disabled={!isValid || submitting}>
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step4Credit;
