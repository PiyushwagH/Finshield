import React from 'react';
import { useAssessment } from './AssessmentWizard';
import styles from './AssessmentWizard.module.css';
import { useNavigate } from 'react-router-dom';

const Step1Personal = ({ onNext }) => {
  const { formData, updateData, schema } = useAssessment();
  const navigate = useNavigate();

  const isValid = 
    formData.age !== '' &&
    formData.gender !== '' &&
    formData.education !== '' &&
    formData.marital_status !== '' &&
    formData.dependents !== '';

  return (
    <div>
      <h2 className={styles.stepTitle}>Personal Details</h2>
      <p className={styles.stepDescription}>
        Let's start with some basic information about you.
      </p>

      <div className={styles.grid2}>
        <div className={styles.inputGroup}>
          <label>Age</label>
          <input 
            type="number" 
            className={styles.input}
            value={formData.age}
            onChange={e => updateData({ age: e.target.value ? parseInt(e.target.value) : '' })}
            placeholder="e.g. 34"
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Gender</label>
          <select 
            className={styles.select}
            value={formData.gender}
            onChange={e => updateData({ gender: e.target.value })}
          >
            <option value="">Select Gender</option>
            {schema?.gender?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.grid1}>
        <div className={styles.inputGroup}>
          <label>Highest Education Level</label>
          <select 
            className={styles.select}
            value={formData.education}
            onChange={e => updateData({ education: e.target.value })}
          >
            <option value="">Select Education</option>
            {schema?.education?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.inputGroup}>
          <label>Marital Status</label>
          <select 
            className={styles.select}
            value={formData.marital_status}
            onChange={e => updateData({ marital_status: e.target.value })}
          >
            <option value="">Select Status</option>
            {schema?.marital_status?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>Number of Dependents</label>
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
          Save and Exit
        </button>
        <div className={styles.navButtons}>
          <button className={styles.btnPrimary} onClick={onNext} disabled={!isValid}>
            Continue &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step1Personal;
