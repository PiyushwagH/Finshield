import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './SchemeDetail.module.css';

const SchemeDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [scheme, setScheme] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [similarSchemes, setSimilarSchemes] = useState([]);

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
        setError('Failed to load scheme details');
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

  if (loading) return <div className={styles.loading}>Loading scheme details...</div>;
  if (error || !scheme) return <div className={styles.error}>{error || 'Not found'}</div>;

  return (
    <div className={styles.container}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        <span onClick={() => navigate('/schemes')}>Scheme Finder</span> &rsaquo; 
        <span>{scheme.category ? scheme.category.charAt(0).toUpperCase() + scheme.category.slice(1) : 'General'}</span> &rsaquo; 
        <strong>{scheme.name}</strong>
      </div>

      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{scheme.name}</h1>
          <p className={styles.ministry}>{scheme.ministry}</p>
          
          <div className={styles.tagsRow}>
            <span className={`${styles.levelTag} ${styles[scheme.level]}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              {scheme.level === 'central' ? 'Central Scheme' : 'State Scheme'}
            </span>
            <span className={styles.categoryTag}>
              {scheme.category?.toUpperCase() || 'GENERAL'}
            </span>
            {scheme.benefit_type && (
              <span className={styles.typeTag}>
                {scheme.benefit_type.charAt(0).toUpperCase() + scheme.benefit_type.slice(1)}
              </span>
            )}
            {scheme.benefit_amount && (
              <span className={styles.amountTag}>
                ₹{scheme.benefit_amount.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Main Content Area */}
        <div className={styles.mainColumn}>
          <div className={styles.tabsContainer}>
            {['Overview', 'Eligibility', 'Documents', 'How to Apply', 'FAQs'].map(tab => (
              <button 
                key={tab} 
                className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'Overview' && (
              <div className={styles.overviewSection}>
                <h3>About the Scheme</h3>
                <p className={styles.fullDesc}>{scheme.full_description}</p>
                
                <h3>Key Benefits</h3>
                <ul className={styles.benefitsList}>
                  {scheme.benefit_description && (
                    <li>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      {scheme.benefit_description}
                    </li>
                  )}
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Coverage across all states and UTs for eligible beneficiaries.
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Direct Benefit Transfer (DBT) where applicable.
                  </li>
                </ul>

                <h3>Scheme Timeline</h3>
                <div className={styles.timelineBox}>
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
                    <div>
                      <span className={styles.timelineLabel}>Last Updated</span>
                      <strong>{scheme.updated_at ? new Date(scheme.updated_at).toLocaleDateString() : 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'Eligibility' && (
              <div className={styles.eligibilitySection}>
                <h3>Eligibility Breakdown</h3>
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
                          <strong>{c.field.replace('_', ' ').toUpperCase()}</strong> requires {c.operator} {Array.isArray(c.rule_value) ? c.rule_value.join(', ') : c.rule_value}
                        </div>
                        <div className={styles.critUserVal}>
                          Your profile: {c.user_value || 'Not provided'}
                        </div>
                      </div>
                    ))}
                    {eligibility.criteria.length === 0 && <p>No specific automated criteria found.</p>}
                  </div>
                ) : (
                  <p className={styles.loginPrompt}>
                    {user ? 'No eligibility breakdown available.' : 'Please log in and take an assessment to see your personalized eligibility breakdown.'}
                  </p>
                )}
              </div>
            )}
            
            {activeTab === 'Documents' && (
              <div className={styles.documentsSection}>
                <h3>Required Documents</h3>
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
                  <p>Document requirements not specified.</p>
                )}
              </div>
            )}
            
            {activeTab === 'How to Apply' && (
              <div className={styles.overviewSection}>
                <h3>Application Mode</h3>
                <p className={styles.fullDesc}>
                  {scheme.application_mode || 'Application mode not specified for this scheme.'}
                </p>

                <h3>Where to Apply</h3>
                <p className={styles.fullDesc}>
                  FinShield links out to the scheme's official government page rather than
                  hosting an application form itself, so your application is always
                  submitted directly on the real government portal.
                </p>
                {scheme.official_url ? (
                  <a href={scheme.official_url} target="_blank" rel="noreferrer" className={styles.primaryActionBtn}>
                    Go to Official Application Portal
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  </a>
                ) : (
                  <p className={styles.qualifyText}>No official application link is on file for this scheme yet.</p>
                )}
              </div>
            )}

            {activeTab === 'FAQs' && (
              <div className={styles.placeholderSection}>
                <p>
                  We don't maintain a separate FAQ for this scheme to avoid giving
                  guidance that could go stale or be wrong. For authoritative
                  answers, check the scheme's official page
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
                  <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> You Qualify</>
                ) : (
                  <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> Not Eligible</>
                )}
              </div>
              <p className={styles.qualifyText}>Based on your saved profile data.</p>
              
              <a 
                href={scheme.official_url || '#'} 
                target="_blank" 
                rel="noreferrer" 
                className={styles.primaryActionBtn}
              >
                Apply on Official Portal
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
              
              <button 
                className={styles.secondaryActionBtn} 
                onClick={handleSave} 
                disabled={saving || saved}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                {saved ? 'Saved' : saving ? 'Saving...' : 'Save Scheme'}
              </button>
            </div>
          ) : (
             <div className={styles.actionCard}>
                <p className={styles.qualifyText}>Log in to check eligibility instantly.</p>
                <button className={styles.primaryActionBtn} onClick={() => navigate('/login')}>Log In</button>
             </div>
          )}

          <div className={styles.similarSchemesCard}>
            <h4 className={styles.similarTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              Similar Schemes
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
                    <span>{s.category ? s.category.charAt(0).toUpperCase() + s.category.slice(1) : 'General'}{s.benefit_type ? ` • ${s.benefit_type.charAt(0).toUpperCase() + s.benefit_type.slice(1)}` : ''}</span>
                  </div>
                ))
              ) : (
                <p className={styles.qualifyText}>No other schemes in this category yet.</p>
              )}
            </div>
          </div>

          <div className={styles.infoCard}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <p>Information last verified on<br/><strong>{scheme.updated_at ? new Date(scheme.updated_at).toLocaleDateString() : 'N/A'}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemeDetail;
