import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './SecurityLog.module.css';

const formatDate = (iso) => new Date(iso).toLocaleString('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const SecurityLog = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await api.getSessions();
      setSessions(res.data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (id) => {
    setRevokingId(id);
    try {
      await api.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to revoke session', err);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Security Log</h1>
        <p className={styles.subtitle}>
          These are the active sessions signed in to your account. Revoke any you don't recognize.
        </p>
      </div>

      {loading ? (
        <p className={styles.emptyState}>Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <p className={styles.emptyState}>No active sessions found.</p>
      ) : (
        sessions.map((s) => (
          <div key={s.id} className={styles.sessionCard}>
            <div className={styles.sessionInfo}>
              <p>
                Session started {formatDate(s.created_at)}
                {s.is_current && <span className={styles.currentBadge}>This device</span>}
              </p>
              <p>Expires {formatDate(s.expires_at)}</p>
            </div>
            <button
              className={styles.revokeBtn}
              onClick={() => handleRevoke(s.id)}
              disabled={revokingId === s.id}
            >
              {revokingId === s.id ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default SecurityLog;
