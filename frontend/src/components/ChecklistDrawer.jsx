import React, { useEffect, useState, useRef } from 'react';
import { assessmentPlanApi } from '../api/assessmentPlan';
import { useLanguage } from '../context/LanguageContext';
import styles from './ChecklistDrawer.module.css';

const ChecklistDrawer = ({ isOpen, onClose, schemeId, schemeName }) => {
  const { lang, t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkedDocs, setCheckedDocs] = useState({});
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !schemeId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setCheckedDocs({});

    assessmentPlanApi.getSchemeChecklist(schemeId, lang)
      .then((res) => {
        if (isMounted) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.response?.data?.detail || 'Failed to load scheme checklist.');
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [isOpen, schemeId, lang]);

  // Handle ESC key and focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleDoc = (docName) => {
    setCheckedDocs((prev) => ({
      ...prev,
      [docName]: !prev[docName]
    }));
  };

  const docs = data?.documents || [];
  const steps = data?.steps || [];
  const checkedCount = docs.filter((d) => checkedDocs[d]).length;

  const formattedDate = data?.last_verified_at 
    ? new Date(data.last_verified_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Recently';

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        ref={drawerRef}
      >
        <div className={styles.header}>
          <div>
            <h2 id="drawer-title" className={styles.title}>{t('checklist.title')}</h2>
            <p className={styles.subtitle}>{schemeName || 'Government Welfare Scheme'}</p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('btn.close')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className={styles.content}>
          {loading && <div className={styles.loading}>Loading application checklist...</div>}
          {error && <div className={styles.error}>{error}</div>}

          {!loading && !error && (
            <>
              {data?.last_verified_at && (
                <div className={styles.verifiedBanner}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
                  <span>{t('checklist.verifiedOn')} {formattedDate}</span>
                </div>
              )}

              {/* Documents Checklist */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>{t('checklist.docs')}</h3>
                  {docs.length > 0 && (
                    <span className={styles.counter}>{checkedCount} of {docs.length} ready</span>
                  )}
                </div>

                {docs.length === 0 ? (
                  <p className={styles.empty}>No specific document requirements recorded.</p>
                ) : (
                  <ul className={styles.docList}>
                    {docs.map((doc, idx) => {
                      const isChecked = !!checkedDocs[doc];
                      return (
                        <li
                          key={idx}
                          className={`${styles.docItem} ${isChecked ? styles.checked : ''}`}
                          onClick={() => toggleDoc(doc)}
                        >
                          <input
                            type="checkbox"
                            id={`doc-${idx}`}
                            checked={isChecked}
                            onChange={() => toggleDoc(doc)}
                            className={styles.checkbox}
                            aria-label={doc}
                          />
                          <label htmlFor={`doc-${idx}`} className={styles.docLabel}>
                            {doc}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Step-by-Step Instructions */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('checklist.steps')}</h3>
                {steps.length === 0 ? (
                  <p className={styles.empty}>Refer to the official portal for application guidelines.</p>
                ) : (
                  <ol className={styles.stepList}>
                    {steps.map((step, idx) => (
                      <li key={idx} className={styles.stepItem}>{step}</li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>

        {data?.official_url && (
          <div className={styles.footer}>
            <a
              href={data.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.portalBtn}
            >
              <span>{t('checklist.officialLink')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChecklistDrawer;
