import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import styles from './Auth.module.css';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      // Stub endpoint
      await apiClient.post('/auth/reset-password', { password });
      setStatusMsg({ type: 'success', text: 'Password has been reset successfully.' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to reset password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>FinShield</Link>
      </header>
      
      <div className={styles.authBox}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--navy)' }}>Create New Password</h2>
        
        {statusMsg && (
          <div className={styles.toast} style={{ backgroundColor: statusMsg.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: statusMsg.type === 'success' ? '#065F46' : 'var(--risk-high)' }}>
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>New Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
