import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import styles from './SchemeUpdates.module.css';

const SchemeUpdates = () => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const res = await api.getSchemeUpdates();
      setUpdates(res.data);
    } catch (err) {
      console.error('Failed to fetch scheme updates', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await api.handleSchemeUpdate(id, action);
      fetchUpdates();
    } catch (err) {
      console.error(err);
      alert('Action failed');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Scheme Updates</h1>
          <p className={styles.subtitle}>Changes detected from official sources</p>
        </div>
        <button className={styles.syncBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21L21.5 8"></path></svg>
          Run Sync Now
        </button>
      </div>

      <div className={styles.tabs}>
        <div className={`${styles.tab} ${styles.active}`}>Pending <span className={styles.badge}>{updates.length}</span></div>
        <div className={styles.tab}>Approved</div>
        <div className={styles.tab}>Rejected</div>
      </div>

      <div className={styles.updatesList}>
        {loading ? (
          <div className={styles.loading}>Loading updates...</div>
        ) : updates.length === 0 ? (
          <div className={styles.empty}>No pending updates.</div>
        ) : (
          updates.map(update => (
            <div key={update.id} className={styles.updateCard}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.statusRow}>
                    <span className={styles.modifiedBadge}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      MODIFIED
                    </span>
                    <span className={styles.detectedTime}>Detected: {new Date(update.detected_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className={styles.schemeName}>{update.scheme_name}</h3>
                  <a href={update.source_url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                    {update.source_url || 'source.gov.in'}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  </a>
                </div>
              </div>

              <div className={styles.diffTable}>
                <div className={styles.diffHeaderRow}>
                  <div className={styles.diffCol}>Field</div>
                  <div className={styles.diffCol}>Current (Old) Value</div>
                  <div className={styles.diffCol}>Detected (New) Value</div>
                </div>
                {Object.entries(update.field_changes).map(([field, diff]) => (
                  <div key={field} className={styles.diffRow}>
                    <div className={styles.diffColName}>{field.replace(/_/g, ' ').toUpperCase()}</div>
                    <div className={styles.diffColOld}>{diff.old}</div>
                    <div className={styles.diffColNew}>{diff.new}</div>
                  </div>
                ))}
              </div>

              <div className={styles.cardActions}>
                <button className={styles.rejectBtn} onClick={() => handleAction(update.id, 'reject')}>Reject</button>
                <button className={styles.editBtn}>Edit Manually</button>
                <button className={styles.approveBtn} onClick={() => handleAction(update.id, 'approve')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Approve and Apply
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SchemeUpdates;
