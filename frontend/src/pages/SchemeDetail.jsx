import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ChecklistDrawer from '../components/ChecklistDrawer';
import styles from './SchemeDetail.module.css';
import { useLanguage } from '../context/LanguageContext';
import { DetailSkeleton } from '../components/Skeleton';

const SchemeDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  
  const [scheme, setScheme] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [similarSchemes, setSimilarSchemes] = useState([]);
  const [checklistOpen, setChecklistOpen] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await api.getSchemeDetail(slug);
        setScheme(res.data);

        if (res.data.category) {
          api.getSchemes({ category: res.data.category, limit: 4 })
            .then(r => setSimilarSchemes(r.data.filter(s => s.id !== res.data.id).slice(0, 2)))
            .catch(() => setSimilarSchemes([]));
        }

        if (user) {
          try {
            const eligRes = await api.checkEligibility(res.data.id);
            setEligibility(eligRes.data);
            
            // Also check if already saved
            const userSchemesRes = await api.getUserSchemes();
            if (userSchemesRes.data.some(s => s.scheme_id === res.data.id)) {
              setSaved(true);
            }
          } catch (e) {
            console.error('Eligibility check failed', e);
          }
        }
      } catch (err) {
        setError(t('detail.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetail();
  }, [slug, user]);

  const handleSave = async () => {
    if (!user) return navigate('/login');
    try {
      setSaving(true);
      await api.saveScheme(scheme.id);
      setSaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (error || !scheme) return <div className={styles.error}>{error || t('detail.notFound')}</div>;

  return (
    <div className={styles.container}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        <span onClick={() => navigate('/schemes')}>{t('finder.title')}</span> &rsaquo; 
        <span>{t(`scat.${scheme.category || 'general'}`)}</span> &rsaquo; 
        <strong>{scheme.name}</strong>
      </div>

      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{scheme.name}</h1>
          <p className={styles.ministry}>{scheme.ministry}</p>
          
          <div className={styles.tagsRow}>
            <span className={`${styles.levelTag} ${styles[scheme.level]}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              {scheme.level === 'central' ? t('detail.centralScheme') : t('detail.stateScheme')}
            </span>
            <span className={styles.categoryTag}>
              {t(`scat.${scheme.category || 'general'}`)}
            </span>
            {scheme.benefit_type && (
              <span className={styles.typeTag}>
                {t(`btype.${scheme.benefit_type}`)}
              </span>
            )}
            {(scheme.benefit_amount_inr || scheme.benefit_amount) && (
              <span className={styles.amountTag}>
                ₹{Number(scheme.benefit_amount_inr || scheme.benefit_amount).toLocaleString('en-IN')}
                {scheme.benefit_period === 'monthly' ? t('finder.perMo') : scheme.benefit_period === 'yearly' ? t('finder.perYr') : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Main Content Area */}
        <div className={styles.mainColumn}>
          <div className={styles.tabsContainer}>
            {[['Overview', 'detail.tabOverview'], ['Eligibility', 'detail.tabEligibility'], ['Documents', 'detail.tabDocuments'], ['How to Apply', 'detail.tabApply'], ['FAQs', 'detail.tabFaqs']].map(([tab, key]) => (
              <button 
                key={tab} 
                className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {t(key)}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'Overview' && (
              <div className={styles.overviewSection}>
                <h3>{t('detail.about')}</h3>
                <p className={styles.fullDesc}>{scheme.full_description}</p>
                
                <h3>{t('detail.keyBenefits')}</h3>
                <ul className={styles.benefitsList}>
                  {scheme.benefit_description && (
                    <li>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      {scheme.benefit_description}
                    </li>
                  )}
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    {scheme.level === 'state' && scheme.state
                      ? t('detail.coverageState', { state: scheme.state })
                      : t('detail.coverageCentral')}
                  </li>
                  {scheme.benefit_type === 'cash' && (
                    <li>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      {t('detail.dbt')}
                    </li>
                  )}
                </ul>

                <h3>{t('detail.timeline')}</h3>
                <div className={styles.timelineBox}>
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
                    <div>
                      <span className={styles.timelineLabel}>{t('detail.lastUpdated')}</span>
                      <strong>{scheme.updated_at ? new Date(scheme.updated_at).toLocaleDateString(locale) : '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'Eligibility' && (
              <div className={styles.eligibilitySection}>
                <h3>{t('detail.eligBreakdown')}</h3>
                {eligibility ? (
                  <div className={styles.eligibilityResults}>
                    {eligibility.criteria?.map((c, idx) => (
                      <div key={idx} className={styles.critRow}>
                        <div className={styles.critIcon}>
                          {c.passed ? 
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--risk-low)" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 12.5l3 3 5-6"></path></svg> :
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--risk-high)" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M15 9l-6 6"></path><path d="M9 9l6 6"></path></svg>
                          }
                        </div>
                        <div className={styles.critText}>
                          <strong>{t(`field.${c.field}`)}</strong> {t(`op.${c.operator}`)} {Array.isArray(c.rule_value) ? c.rule_value.join(c.operator === 'between' ? ' – ' : ', ') : String(c.rule_value)}
                        </div>
                        <div className={styles.critUserVal}>
                          {t('detail.yourProfile', { v: c.user_value === null || c.user_value === undefined ? t('detail.notProvided') : Array.isArray(c.user_value) ? c.user_value.join(', ') : String(c.user_value) })}
                        </div>
                      </div>
                    ))}
                    {eligibility.criteria.length === 0 && <p>{t('detail.noCriteria')}</p>}
                  </div>
                ) : (
                  <p className={styles.loginPrompt}>
                    {user ? t('detail.noBreakdown') : t('detail.loginForBreakdown')}
                  </p>
                )}
              </div>
            )}
            
            {activeTab === 'Documents' && (
              <div className={styles.documentsSection}>
                <h3>{t('detail.requiredDocs')}</h3>
                {scheme.required_documents?.length > 0 ? (
                  <ul className={styles.docList}>
                    {scheme.required_documents.map((doc, idx) => (
                      <li key={idx}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        {doc}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t('detail.docsNotSpecified')}</p>
                )}
              </div>
            )}
            
            {activeTab === 'How to Apply' && (
              <div className={styles.overviewSection}>
                <h3>{t('detail.appMode')}</h3>
                <p className={styles.fullDesc}>
                  {scheme.application_mode || t('detail.appModeMissing')}
                </p>

                <h3>{t('detail.whereApply')}</h3>
                <p className={styles.fullDesc}>
                  {t('detail.whereApplyText')}
                </p>
                {scheme.official_url ? (
                  <a href={scheme.official_url} target="_blank" rel="noreferrer" className={styles.primaryActionBtn}>
                    {t('detail.goPortal')}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  </a>
                ) : (
                  <p className={styles.qualifyText}>{t('detail.noLink')}</p>
                )}
              </div>
            )}

            {activeTab === 'FAQs' && (
              <div className={styles.placeholderSection}>
                <p>
                  {t('detail.faqText')}
                  {scheme.official_url && (
                    <> — <a href={scheme.official_url} target="_blank" rel="noreferrer">{scheme.official_url}</a></>
                  )}.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar (Action Cards) */}
        <div className={styles.sidebarColumn}>
          {eligibility ? (
            <div className={styles.actionCard}>
              <div className={eligibility.is_eligible ? styles.qualifyBadge : styles.notQualifyBadge}>
                {eligibility.is_eligible ? (
                  <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> {t('detail.youQualify')}</>
                ) : (
                  <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> {t('detail.notEligible')}</>
                )}
              </div>
              <p className={styles.qualifyText}>{t('detail.basedOnProfile')}</p>
              
              <a 
                href={scheme.official_url || '#'} 
                target="_blank" 
                rel="noreferrer" 
                className={styles.primaryActionBtn}
              >
                {t('detail.applyPortal')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>

              <button 
                className={styles.secondaryActionBtn} 
                onClick={() => setChecklistOpen(true)}
                style={{ marginBottom: '0.75rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                {t('detail.viewChecklist')}
              </button>
              
              <button 
                className={styles.secondaryActionBtn} 
                onClick={handleSave} 
                disabled={saving || saved}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                {saved ? t('detail.saved') : saving ? t('detail.saving') : t('detail.save')}
              </button>
            </div>
          ) : (
             <div className={styles.actionCard}>
                <p className={styles.qualifyText}>{t('detail.loginToCheck')}</p>
                <button className={styles.primaryActionBtn} onClick={() => navigate('/login')}>{t('detail.login')}</button>
                <button 
                  className={styles.secondaryActionBtn} 
                  onClick={() => setChecklistOpen(true)}
                  style={{ marginTop: '0.75rem' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                  {t('detail.viewChecklist')}
                </button>
             </div>
          )}

          <div className={styles.similarSchemesCard}>
            <h4 className={styles.similarTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              {t('detail.similar')}
            </h4>
            <div className={styles.similarList}>
              {similarSchemes.length > 0 ? (
                similarSchemes.map(s => (
                  <div
                    key={s.id}
                    className={styles.similarItem}
                    onClick={() => navigate(`/schemes/${s.slug}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h5>{s.name}</h5>
                    <span>{t(`scat.${s.category || 'general'}`)}{s.benefit_type ? ` • ${t(`btype.${s.benefit_type}`)}` : ''}</span>
                  </div>
                ))
              ) : (
                <p className={styles.qualifyText}>{t('detail.noSimilar')}</p>
              )}
            </div>
          </div>

          <div className={styles.infoCard}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <p>{t('detail.verifiedOn')}<br/><strong>{scheme.last_verified_at ? new Date(scheme.last_verified_at).toLocaleDateString(locale) : scheme.updated_at ? new Date(scheme.updated_at).toLocaleDateString(locale) : '—'}</strong></p>
          </div>
        </div>
      </div>

      <ChecklistDrawer
        schemeId={scheme.id}
        schemeName={scheme.name}
        isOpen={checklistOpen}
        onClose={() => setChecklistOpen(false)}
      />
    </div>
  );
};

export default SchemeDetail;
