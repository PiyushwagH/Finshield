import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import styles from './Auth.module.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setStatusMsg({ type: 'success', text: 'If an account exists, a reset link has been sent.' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to request password reset' });
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
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--navy)' }}>Reset Password</h2>
        
        {statusMsg && (
          <div className={styles.toast} style={{ backgroundColor: statusMsg.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: statusMsg.type === 'success' ? '#065F46' : 'var(--risk-high)' }}>
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link to="/login" style={{ color: 'var(--teal)', fontSize: '0.875rem' }}>Back to login</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
