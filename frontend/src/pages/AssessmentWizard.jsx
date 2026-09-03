import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import styles from './AssessmentWizard.module.css';
import Step1Personal from './Step1Personal';
import Step2Employment from './Step2Employment';
import Step3Finances from './Step3Finances';
import Step4Credit from './Step4Credit';

const AssessmentContext = createContext();

export const useAssessment = () => useContext(AssessmentContext);

const STEPS = ['Personal', 'Employment', 'Finances', 'Credit History'];

const INITIAL_DATA = {
  age: '',
  gender: '',
  education: '',
  marital_status: '',
  dependents: '',
  employment_status: '',
  years_employed: '',
  annual_income: null,
  monthly_emi: null,
  existing_total_debt: null,
  asset_value: null,
  monthly_expenditure: null,
  savings: null,
  owns_vehicle: false,
  owns_property: false,
  has_prior_credit: false,
  n_prior_credits: '',
  n_active_credits: '',
  years_credit_history: '',
  has_defaulted: false,
  payment_history: ''
};

const AssessmentWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('finshield_assessment');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const res = await apiClient.get('/risk/schema');
        setSchema(res.data);
      } catch (err) {
        setError('Failed to load form options. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchSchema();
  }, []);

  useEffect(() => {
    localStorage.setItem('finshield_assessment', JSON.stringify(formData));
  }, [formData]);

  const updateData = (fields) => {
    setFormData(prev => ({ ...prev, ...fields }));
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const submitAssessment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Clean up credit fields if has_prior_credit is false
      const payload = { ...formData };
      if (!payload.has_prior_credit) {
        payload.n_prior_credits = 0;
        payload.n_active_credits = 0;
        payload.years_credit_history = 0;
        payload.has_defaulted = false;
        payload.payment_history = 'No History';
      }
      
      const res = await apiClient.post('/risk/assess', payload);
      localStorage.removeItem('finshield_assessment');
      navigate(`/assessment/result/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit assessment.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading assessment...</div>;
  }

  if (error && !schema) {
    return <div className={styles.errorFull}>{error}</div>;
  }

  return (
    <AssessmentContext.Provider value={{ formData, updateData, schema }}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>Risk Assessment</h1>
            <span className={styles.stepIndicator}>Step {currentStep} of 4</span>
          </div>
          <div className={styles.progressContainer}>
            {STEPS.map((step, idx) => {
              const stepNum = idx + 1;
              const isActive = stepNum === currentStep;
              const isPast = stepNum < currentStep;
              return (
                <div key={step} className={styles.progressSegmentWrapper}>
                   <div className={`${styles.progressSegment} ${isActive || isPast ? styles.activeSegment : ''}`}></div>
                   <span className={`${styles.progressLabel} ${isActive ? styles.activeLabel : ''}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.mainForm}>
            {currentStep === 1 && <Step1Personal onNext={nextStep} />}
            {currentStep === 2 && <Step2Employment onNext={nextStep} onPrev={prevStep} />}
            {currentStep === 3 && <Step3Finances onNext={nextStep} onPrev={prevStep} />}
            {currentStep === 4 && <Step4Credit onSubmit={submitAssessment} onPrev={prevStep} submitting={submitting} />}
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.infoCard}>
              <h3 className={styles.infoTitle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Why we ask this
              </h3>
              <p className={styles.infoText}>
                These details help us calculate your debt-to-income ratio and assess
                overall financial stability. Accurate information ensures we provide the
                most relevant risk profile and welfare eligibility options.
              </p>
              
              <div className={styles.secureBadge}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.secureIcon}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <div>
                  <strong>Secure & Encrypted</strong>
                  <span>Your financial data is encrypted at rest and in transit. It is only used for internal assessment purposes.</span>
                </div>
              </div>
            </div>
            {error && <div className={styles.errorToast}>{error}</div>}
          </aside>
        </div>
      </div>
    </AssessmentContext.Provider>
  );
};

export default AssessmentWizard;
