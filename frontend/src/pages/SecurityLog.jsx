import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './SecurityLog.module.css';
import { useLanguage } from '../context/LanguageContext';
import { ListItemsSkeleton } from '../components/Skeleton';

const formatDate = (iso, locale) => new Date(iso).toLocaleString(locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const SecurityLog = () => {
  const { t, locale } = useLanguage();
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
        <h1 className={styles.title}>{t('sec.title')}</h1>
        <p className={styles.subtitle}>
          {t('sec.subtitle')}
        </p>
      </div>

      {loading ? (
        <ListItemsSkeleton count={3} />
      ) : sessions.length === 0 ? (
        <p className={styles.emptyState}>{t('sec.none')}</p>
      ) : (
        sessions.map((s) => (
          <div key={s.id} className={styles.sessionCard}>
            <div className={styles.sessionInfo}>
              <p>
                {t('sec.started', { date: formatDate(s.created_at, locale) })}
                {s.is_current && <span className={styles.currentBadge}>{t('sec.thisDevice')}</span>}
              </p>
              <p>{t('sec.expires', { date: formatDate(s.expires_at, locale) })}</p>
            </div>
            <button
              className={styles.revokeBtn}
              onClick={() => handleRevoke(s.id)}
              disabled={revokingId === s.id}
            >
              {revokingId === s.id ? t('sec.revoking') : t('sec.revoke')}
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default SecurityLog;
