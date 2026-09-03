import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import styles from './MySchemes.module.css';

const MySchemes = () => {
  const navigate = useNavigate();
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

  if (loading) return <div className={styles.loading}>Loading tracking dashboard...</div>;

  const displaySchemes = getFilteredSchemes();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Schemes</h1>
          <p className={styles.subtitle}>Track your saved and applied welfare programs.</p>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span>Saved</span>
            <strong>{savedCount}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Applied</span>
            <strong>{appliedCount}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Approved</span>
            <strong className={styles.approvedText}>{approvedCount}</strong>
          </div>
          <div className={styles.statCardTotal}>
            <span>Total Potential Benefit</span>
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
              {tab}
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
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                    <span className={styles.dateText}>
                      {item.status === 'saved' ? 'Saved on' : 'Updated on'} {new Date(item.updated_at || item.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                    <span className={styles.benefitLabel}>Benefit Amount</span>
                    <span className={styles.benefitValue}>
                      {item.scheme.benefit_amount ? `₹${item.scheme.benefit_amount.toLocaleString('en-IN')}` : 'Variable'}
                    </span>
                  </div>
                  
                  <select 
                    className={styles.statusDropdown}
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                  >
                    <option value="saved">Saved</option>
                    <option value="applied">Applied</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>No schemes found in this category.</p>
              <button className={styles.findBtn} onClick={() => navigate('/schemes')}>
                Find Schemes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MySchemes;
