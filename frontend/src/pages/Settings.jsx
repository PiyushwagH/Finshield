import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Settings.module.css';

const Settings = () => {
  const { user, logout } = useAuth();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account details and session.</p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Profile</h2>
        <div className={styles.row}>
          <span className={styles.label}>Name</span>
          <span className={styles.value}>{user?.full_name || '—'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Email</span>
          <span className={styles.value}>{user?.email}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Role</span>
          <span className={styles.value}>{user?.role === 'admin' ? 'Administrator' : 'User'}</span>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Password</h2>
        <p className={styles.label} style={{ marginBottom: '1rem' }}>
          Reset your password via the email-based reset flow used for sign-in.
        </p>
        <Link to="/forgot-password" className={styles.actionBtn}>Send reset link</Link>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Session</h2>
        <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
};

export default Settings;
