import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

const Auth = ({ mode = 'user' }) => {
  const isAdmin = mode === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  // The admin console has no self-service sign-up, so it is login-only.
  const initialTab = !isAdmin && searchParams.get('tab') === 'register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loadingState, setLoadingState] = useState(false);
  
  // Validation / Error handling
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  
  const { login, loginAdmin, register, user } = useAuth();
  const navigate = useNavigate();

  // Where each portal lands once a session exists.
  const landingPath = isAdmin ? '/admin/analytics' : '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' && isAdmin ? '/admin/analytics' : '/dashboard', { replace: true });
    }
  }, [user, navigate, isAdmin]);

  useEffect(() => {
    setErrors({});
    setToast(null);
    if (!isAdmin) setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams, isAdmin]);

  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    else if (activeTab === 'register') {
      if (password.length < 8) newErrors.password = 'Password must be at least 8 characters long';
      else if (!/[A-Za-z]/.test(password)) newErrors.password = 'Password must contain at least one letter';
      else if (!/\d/.test(password)) newErrors.password = 'Password must contain at least one number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoadingState(true);
    setToast(null);
    setErrors({});
    try {
      if (activeTab === 'login') {
        await (isAdmin ? loginAdmin(email, password) : login(email, password));
      } else {
        await register({ email, password, full_name: fullName });
      }
      navigate(landingPath, { replace: true });
    } catch (err) {
      if (err.response?.status === 401 && activeTab === 'login') {
         setErrors({ password: 'Incorrect password. Please try again.' });
      } else if (err.response?.status === 403) {
         // Admin endpoint accepted the credentials but the account is not an admin.
         setToast(err.response?.data?.detail || 'This account does not have administrator access');
      } else if (err.response?.status === 422) {
         setToast('Invalid input data');
      } else {
         setToast(err.response?.data?.detail || 'An unexpected error occurred');
      }
    } finally {
      setLoadingState(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logoContainer}>
         <Link to="/">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--navy)'}}>
             <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
           </svg>
         </Link>
      </div>

      <div className={styles.authCard}>
        {isAdmin ? (
          <div className={styles.adminBadge}>Administrator Access</div>
        ) : (
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'login' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('login')}
              type="button"
            >
              Log In
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'register' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('register')}
              type="button"
            >
              Sign Up
            </button>
          </div>
        )}

        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <h1 className={styles.title}>
              {isAdmin ? 'Admin sign in' : (activeTab === 'login' ? 'Welcome back' : 'Create an account')}
            </h1>
            <p className={styles.subtitle}>
              {isAdmin
                ? 'Restricted to accounts with the administrator role.'
                : (activeTab === 'login' ? 'Enter your details to access your account.' : 'Join FinShield to analyze your financial risk.')}
            </p>
          </div>

          {toast && <div className={styles.toast}>{toast}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            {activeTab === 'register' && (
              <div className={styles.inputWrapper}>
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className={styles.input}
                />
              </div>
            )}
            
            <div className={`${styles.inputWrapper} ${errors.email ? styles.inputError : ''}`}>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className={styles.input}
              />
              {errors.email && (
                 <div className={styles.errorMessage}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    {errors.email}
                 </div>
              )}
            </div>

            <div className={`${styles.inputWrapper} ${errors.password ? styles.inputError : ''}`}>
              <div className={styles.passwordContainer}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={styles.input}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  )}
                </button>
              </div>
              {errors.password && (
                 <div className={styles.errorMessage}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    {errors.password}
                 </div>
              )}
            </div>

            {activeTab === 'login' && (
              <div className={styles.formOptions}>
                <label className={styles.checkboxContainer}>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span className={styles.checkmark}></span>
                  Remember me
                </label>
                <Link to="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={loadingState}>
              {loadingState ? (
                <span className={styles.spinner}></span>
              ) : isAdmin ? (
                'Log In as Admin'
              ) : (
                activeTab === 'login' ? 'Log In' : 'Sign Up'
              )}
            </button>
          </form>

          <div className={styles.portalSwitch}>
            {isAdmin ? (
              <Link to="/login">Not an administrator? User log in</Link>
            ) : (
              <Link to="/admin/login">Administrator log in</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
