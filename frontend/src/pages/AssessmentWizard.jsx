import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './AssessmentWizard.module.css';
import { useLanguage } from '../context/LanguageContext';
import Step1Personal from './Step1Personal';
import Step2Employment from './Step2Employment';
import Step3Finances from './Step3Finances';
import Step4Credit from './Step4Credit';
import { FormSkeleton } from '../components/Skeleton';

const AssessmentContext = createContext();

export const useAssessment = () => useContext(AssessmentContext);

const STEPS = ['wiz.stepPersonal', 'wiz.stepEmployment', 'wiz.stepFinances', 'wiz.stepCredit'];

const INITIAL_DATA = {
  age: '',
  gender: '',
  education: '',
  marital_status: '',
  dependents: '',
  employment_status: '',
  years_employed: '',
  annual_income: null,
  has_active_loans: false,
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

// Drafts are keyed per account. A single shared key would show one user's
// finances to whoever logs in next on the same browser.
export const draftKeyFor = (userId) => `finshield_assessment:${userId}`;
const LEGACY_DRAFT_KEY = 'finshield_assessment';

// FastAPI error bodies vary by failure: a plain string (auth/business errors),
// a single {msg} object, or - on a 422 - a list of per-field validation errors.
// Rendering any of the non-string shapes directly as a React child crashes the
// page (React refuses to render objects), which is what produced the blank
// screen here. This always reduces to a renderable string.
const describeSubmitError = (err) => {
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const field = Array.isArray(e?.loc) ? e.loc.at(-1) : null;
        return field ? `${field}: ${e.msg}` : e?.msg;
      })
      .filter(Boolean)
      .join('; ') || null;
  }
  if (detail && typeof detail === 'object' && typeof detail.msg === 'string') return detail.msg;
  return null;
};

const AssessmentWizard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const storageKey = user ? draftKeyFor(user.id) : null;
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_DATA);
  // Guards the save effect so it cannot overwrite the draft before it loads.
  const [draftLoaded, setDraftLoaded] = useState(false);
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
        setError(t('wiz.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchSchema();
  }, []);

  // Load this account's draft, and reset the form when the account changes.
  useEffect(() => {
    // Older builds stored drafts globally; drop any left behind.
    localStorage.removeItem(LEGACY_DRAFT_KEY);
    if (!storageKey) return;

    setDraftLoaded(false);
    let draft = INITIAL_DATA;
    try {
      const saved = localStorage.getItem(storageKey);
      // Merge onto INITIAL_DATA so a draft from an older field set stays valid.
      if (saved) draft = { ...INITIAL_DATA, ...JSON.parse(saved) };
    } catch {
      draft = INITIAL_DATA;
    }
    setFormData(draft);
    setCurrentStep(1);
    setDraftLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !draftLoaded) return;
    localStorage.setItem(storageKey, JSON.stringify(formData));
  }, [formData, storageKey, draftLoaded]);

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
      const payload = { ...formData };

      // has_active_loans is a UI-only toggle, not a backend field - it just
      // decides whether the EMI/loan-balance inputs are shown. Zero those
      // fields when it's off (covers the case where the user never touched
      // the toggle and they're still null) and strip it before sending.
      if (!payload.has_active_loans) {
        payload.monthly_emi = 0;
        payload.existing_total_debt = 0;
      }
      delete payload.has_active_loans;

      // Clean up credit fields if has_prior_credit is false
      if (!payload.has_prior_credit) {
        payload.n_prior_credits = 0;
        payload.n_active_credits = 0;
        payload.years_credit_history = 0;
        payload.has_defaulted = false;
        // Must match the backend's Literal value, not a display label.
        payload.payment_history = 'no_history';
      }
      
      const res = await apiClient.post('/risk/assess', payload);
      if (storageKey) localStorage.removeItem(storageKey);
      navigate(`/assessment/result/${res.data.id}`);
    } catch (err) {
      setError(describeSubmitError(err) || t('wiz.submitFailed'));
      setSubmitting(false);
    }
  };

  if (loading) {
    return <FormSkeleton />;
  }

  if (error && !schema) {
    return <div className={styles.errorFull}>{error}</div>;
  }

  return (
    <AssessmentContext.Provider value={{ formData, updateData, schema }}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>{t('wiz.title')}</h1>
            <span className={styles.stepIndicator}>{t('wiz.stepOf', { n: currentStep })}</span>
          </div>
          <div className={styles.progressContainer}>
            {STEPS.map((step, idx) => {
              const stepNum = idx + 1;
              const isActive = stepNum === currentStep;
              const isPast = stepNum < currentStep;
              return (
                <div key={step} className={styles.progressSegmentWrapper}>
                   <div className={`${styles.progressSegment} ${isActive || isPast ? styles.activeSegment : ''}`}></div>
                   <span className={`${styles.progressLabel} ${isActive ? styles.activeLabel : ''}`}>{t(step)}</span>
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
                {t('wiz.whyTitle')}
              </h3>
              <p className={styles.infoText}>
                {t('wiz.whyText')}
              </p>
              
              <div className={styles.secureBadge}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.secureIcon}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <div>
                  <strong>{t('wiz.secureTitle')}</strong>
                  <span>{t('wiz.secureText')}</span>
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
