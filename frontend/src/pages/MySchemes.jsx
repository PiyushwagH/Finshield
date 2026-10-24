import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import styles from './MySchemes.module.css';
import { useLanguage } from '../context/LanguageContext';
import { ListPageSkeleton } from '../components/Skeleton';

const MySchemes = () => {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const [userSchemes, setUserSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Saved');
  
  useEffect(() => {
    fetchMySchemes();
  }, []);

  const fetchMySchemes = async () => {
    try {
      setLoading(true);
      const res = await api.getUserSchemes();
      setUserSchemes(res.data);
    } catch (err) {
      console.error('Failed to fetch user schemes', err);
    } finally {
      setLoading(false);
    }
  };

  const savedCount = userSchemes.filter(s => s.status === 'saved').length;
  const appliedCount = userSchemes.filter(s => s.status === 'applied' || s.status === 'under_review').length;
  const approvedCount = userSchemes.filter(s => s.status === 'approved').length;
  
  // Calculate total potential benefits from saved schemes (very basic)
  const totalPotential = userSchemes.reduce((acc, curr) => {
    if (curr.scheme && curr.scheme.benefit_amount) {
      return acc + Number(curr.scheme.benefit_amount);
    }
    return acc;
  }, 0);

  const getFilteredSchemes = () => {
    if (activeTab === 'Saved') return userSchemes.filter(s => s.status === 'saved');
    if (activeTab === 'Applied') return userSchemes.filter(s => s.status === 'applied' || s.status === 'under_review' || s.status === 'approved');
    if (activeTab === 'Rejected') return userSchemes.filter(s => s.status === 'rejected');
    return [];
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.updateSchemeStatus(id, { status: newStatus });
      fetchMySchemes(); // Refresh
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  if (loading) return <ListPageSkeleton count={6} />;

  const displaySchemes = getFilteredSchemes();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('my.title')}</h1>
          <p className={styles.subtitle}>{t('my.subtitle')}</p>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span>{t('status.saved')}</span>
            <strong>{savedCount}</strong>
          </div>
          <div className={styles.statCard}>
            <span>{t('status.applied')}</span>
            <strong>{appliedCount}</strong>
          </div>
          <div className={styles.statCard}>
            <span>{t('status.approved')}</span>
            <strong className={styles.approvedText}>{approvedCount}</strong>
          </div>
          <div className={styles.statCardTotal}>
            <span>{t('my.totalPotential')}</span>
            <strong>₹ {totalPotential.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.tabsRow}>
          {['Saved', 'Applied', 'Rejected'].map(tab => (
            <button 
              key={tab}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {t(`status.${tab.toLowerCase()}`)}
            </button>
          ))}
        </div>

        <div className={styles.listContainer}>
          {displaySchemes.length > 0 ? (
            displaySchemes.map(item => (
              <div key={item.id} className={styles.schemeRow}>
                <div className={styles.rowMain}>
                  <div className={styles.metaRow}>
                    <span className={styles.statusPill}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                      {t(`status.${item.status}`)}
                    </span>
                    <span className={styles.dateText}>
                      {t(item.status === 'saved' ? 'my.savedOn' : 'my.updatedOn', { date: new Date(item.updated_at || item.saved_at).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) })}
                    </span>
                  </div>
                  <h3 
                    className={styles.schemeName}
                    onClick={() => navigate(`/schemes/${item.scheme.slug}`)}
                  >
                    {item.scheme.name}
                  </h3>
                  <p className={styles.ministry}>{item.scheme.ministry}</p>
                </div>
                
                <div className={styles.rowActions}>
                  <div className={styles.benefitInfo}>
                    <span className={styles.benefitLabel}>{t('my.benefitAmount')}</span>
                    <span className={styles.benefitValue}>
                      {item.scheme.benefit_amount ? `₹${Number(item.scheme.benefit_amount).toLocaleString('en-IN')}` : t('my.variable')}
                    </span>
                  </div>
                  
                  <select 
                    className={styles.statusDropdown}
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                  >
                    {['saved', 'applied', 'under_review', 'approved', 'rejected'].map((st) => (
                      <option key={st} value={st}>{t(`status.${st}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>{t('my.none')}</p>
              <button className={styles.findBtn} onClick={() => navigate('/schemes')}>
                {t('my.find')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MySchemes;
