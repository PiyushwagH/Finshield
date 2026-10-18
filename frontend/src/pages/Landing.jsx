import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Landing.module.css';

const Landing = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>FinShield</div>
        <nav className={styles.navLinks}>
          <Link to="/" className={styles.activeLink}>Home</Link>
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/schemes">Schemes</Link>
          <Link to="/about">About</Link>
        </nav>
        <div className={styles.authLinks}>
          <Link to="/admin/login" className={styles.adminLoginBtn}>Admin Login</Link>
          <Link to="/login" className={styles.userLoginBtn}>User Login</Link>
          <Link to="/login?tab=register" className={styles.registerBtn}>Get Started</Link>
        </div>
      </header>
      
      <main className={styles.main}>
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Know your financial risk.<br/>Find the schemes you deserve.
            </h1>
            <p className={styles.heroSubtitle}>
              FinShield analyzes your financial profile using machine learning,
              explains the result in plain language, and matches you with
              Indian government welfare schemes you are eligible for.
            </p>
            <div className={styles.heroCta}>
              <Link to="/login?tab=register" className={styles.primaryCta}>Check My Risk — Free</Link>
              <Link to="/schemes" className={styles.secondaryCta}>Browse Schemes</Link>
            </div>
          </div>
          <div className={styles.heroImageContainer}>
             <div className={styles.heroImagePlaceholder}>
               <svg viewBox="0 0 560 315" className={styles.heroIllustration} role="img" aria-label="Illustration of a FinShield risk assessment dashboard">
                 <rect x="0" y="0" width="560" height="315" fill="#F7F9FC" />

                 {/* Gauge card */}
                 <rect x="28" y="28" width="230" height="259" rx="14" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
                 <text x="50" y="62" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="600" fill="#5B6B7F">Risk Score</text>
                 <path d="M 70 170 A 72 72 0 0 1 214 170" fill="none" stroke="#E2E8F0" strokeWidth="14" strokeLinecap="round" />
                 <path d="M 70 170 A 72 72 0 0 1 180 108" fill="none" stroke="#16A34A" strokeWidth="14" strokeLinecap="round" />
                 <text x="142" y="165" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="34" fontWeight="700" fill="#0F2A47">742</text>
                 <text x="142" y="186" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fill="#5B6B7F">out of 850</text>
                 <rect x="100" y="200" width="84" height="24" rx="12" fill="#D1FAE5" />
                 <text x="142" y="216" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700" fill="#16A34A">LOW RISK</text>
                 <rect x="50" y="245" width="166" height="8" rx="4" fill="#F7F9FC" />
                 <rect x="50" y="245" width="118" height="8" rx="4" fill="#0E8F86" />
                 <text x="50" y="270" fontFamily="Inter, sans-serif" fontSize="11" fill="#5B6B7F">Affordability: Comfortable</text>

                 {/* Scheme match card */}
                 <rect x="276" y="28" width="256" height="118" rx="14" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
                 <text x="298" y="56" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="600" fill="#5B6B7F">Matched Schemes</text>
                 <circle cx="306" cy="80" r="4" fill="#0E8F86" />
                 <text x="318" y="84" fontFamily="Inter, sans-serif" fontSize="12" fill="#1A2332">PM-KISAN</text>
                 <circle cx="306" cy="104" r="4" fill="#0E8F86" />
                 <text x="318" y="108" fontFamily="Inter, sans-serif" fontSize="12" fill="#1A2332">PMAY (Urban)</text>
                 <circle cx="306" cy="128" r="4" fill="#0E8F86" />
                 <text x="318" y="132" fontFamily="Inter, sans-serif" fontSize="12" fill="#1A2332">Atal Pension Yojana</text>

                 {/* Trend card */}
                 <rect x="276" y="162" width="256" height="125" rx="14" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
                 <text x="298" y="190" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="600" fill="#5B6B7F">Risk Trend</text>
                 <polyline points="298,250 350,235 402,255 454,210 506,222" fill="none" stroke="#0F2A47" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                 <circle cx="298" cy="250" r="4" fill="#0F2A47" />
                 <circle cx="506" cy="222" r="4" fill="#0F2A47" />
               </svg>
             </div>
          </div>
        </section>

        <section className={styles.statsSection}>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <h3 className={styles.statValue}>307,511</h3>
            <p className={styles.statLabel}>records trained on</p>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
            </div>
            <h3 className={styles.statValue}>0.685</h3>
            <p className={styles.statLabel}>AUC model accuracy</p>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
            <h3 className={styles.statValue}>500+</h3>
            <p className={styles.statLabel}>government schemes indexed</p>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h3 className={styles.statValue}>Bank-grade</h3>
            <p className={styles.statLabel}>data encryption</p>
          </div>
        </section>

        <section className={styles.featuresSection}>
          <h2 className={styles.sectionTitle}>Comprehensive Analysis & Matching</h2>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h3 className={styles.featureTitle}>Financial Risk Assessment</h3>
              <p className={styles.featureDesc}>A machine learning model trained on 300,000+ real lending records scores your financial risk in under a minute.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              </div>
              <h3 className={styles.featureTitle}>Explainable Results</h3>
              <p className={styles.featureDesc}>See exactly which factors raised or lowered your score, not just a number. Transparency you can trust.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <h3 className={styles.featureTitle}>Government Scheme Matching</h3>
              <p className={styles.featureDesc}>Automatically matched to central and state welfare schemes based on your profile and eligibility criteria.</p>
            </div>
          </div>
        </section>

        <section className={styles.howItWorksSection}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <div className={styles.stepsContainer}>
            <div className={styles.step}>
              <div className={styles.stepCircle}>1</div>
              <p className={styles.stepLabel}>Create Account</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepCircle}>2</div>
              <p className={styles.stepLabel}>Fill Your Profile</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepCircle}>3</div>
              <p className={styles.stepLabel}>Get Your Risk Report</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepCircle}>4</div>
              <p className={styles.stepLabel}>Discover Eligible Schemes</p>
            </div>
          </div>
        </section>
      </main>
      
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>FinShield</div>
            <p className={styles.footerCopy}>&copy; 2024 FinShield Academic Project. Bank-grade 256-bit SSL Security.</p>
          </div>
          <div className={styles.footerLinks}>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/security">Security Disclosure</Link>
            <Link to="/methodology">Methodology</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
