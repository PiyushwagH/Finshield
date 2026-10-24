import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import styles from './Auth.module.css';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !token) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, new_password: password });
      setStatusMsg({ type: 'success', text: t('reset.success') });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setStatusMsg({ type: 'error', text: typeof detail === 'string' ? detail : t('reset.failed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.langCorner}><LanguageSwitcher /></div>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>FinShield</Link>
      </header>

      <div className={styles.authBox}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--navy)' }}>{t('reset.title')}</h2>

        {!token ? (
          <div className={styles.toast} style={{ backgroundColor: '#FEE2E2', color: 'var(--risk-high)' }}>
            {t('reset.missingToken')}{' '}
            <Link to="/forgot-password" style={{ color: 'inherit', textDecoration: 'underline' }}>
              {t('reset.forgotPage')}
            </Link>.
          </div>
        ) : (
          <>
            {statusMsg && (
              <div className={styles.toast} style={{ backgroundColor: statusMsg.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: statusMsg.type === 'success' ? '#065F46' : 'var(--risk-high)' }}>
                {statusMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label>{t('reset.newPassword')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? t('reset.resetting') : t('reset.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
