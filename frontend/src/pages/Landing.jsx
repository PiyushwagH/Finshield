import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import styles from './Landing.module.css';

const Landing = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  if (loading) return null;
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.container} id="top">
      <header className={styles.header}>
        <Link to="/" className={styles.logo} onClick={closeMenu}>FinShield</Link>

        <nav className={styles.navLinks} aria-label="Primary">
          <a href="#top" className={styles.activeLink}>{t('landing.navHome')}</a>
          <a href="#how-it-works">{t('landing.navHow')}</a>
          <Link to="/schemes">{t('landing.navSchemes')}</Link>
          <a href="#features">{t('landing.navAbout')}</a>
        </nav>

        <div className={styles.authLinks}>
          <LanguageSwitcher />
          <Link to="/admin/login" className={styles.adminLoginBtn}>{t('landing.adminLogin')}</Link>
          <Link to="/login" className={styles.userLoginBtn}>{t('landing.userLogin')}</Link>
          <Link to="/login?tab=register" className={styles.registerBtn}>{t('landing.getStarted')}</Link>
        </div>

        <button
          type="button"
          className={styles.menuBtn}
          aria-label={t('landing.menu')}
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          )}
        </button>

        {menuOpen && (
          <div id="landing-mobile-menu" className={styles.mobileMenu}>
            <a href="#top" onClick={closeMenu}>{t('landing.navHome')}</a>
            <a href="#how-it-works" onClick={closeMenu}>{t('landing.navHow')}</a>
            <Link to="/schemes" onClick={closeMenu}>{t('landing.navSchemes')}</Link>
            <a href="#features" onClick={closeMenu}>{t('landing.navAbout')}</a>
            <div className={styles.mobileDivider} />
            <Link to="/login" onClick={closeMenu}>{t('landing.userLogin')}</Link>
            <Link to="/admin/login" onClick={closeMenu}>{t('landing.adminLogin')}</Link>
            <Link to="/login?tab=register" className={styles.registerBtn} onClick={closeMenu}>{t('landing.getStarted')}</Link>
            <LanguageSwitcher />
          </div>
        )}
      </header>
      
      <main className={styles.main}>
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              {t('landing.heroLine1')}<br/>{t('landing.heroLine2')}
            </h1>
            <p className={styles.heroSubtitle}>
              {t('landing.heroSubtitle')}
            </p>
            <div className={styles.heroCta}>
              <Link to="/login?tab=register" className={styles.primaryCta}>{t('landing.ctaPrimary')}</Link>
              <Link to="/schemes" className={styles.secondaryCta}>{t('landing.ctaSecondary')}</Link>
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
            <p className={styles.statLabel}>{t('landing.statRecords')}</p>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
            </div>
            <h3 className={styles.statValue}>0.685</h3>
            <p className={styles.statLabel}>{t('landing.statAuc')}</p>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
            <h3 className={styles.statValue}>500+</h3>
            <p className={styles.statLabel}>{t('landing.statSchemes')}</p>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h3 className={styles.statValue}>{t('landing.statSecurityValue')}</h3>
            <p className={styles.statLabel}>{t('landing.statSecurity')}</p>
          </div>
        </section>

        <section className={styles.featuresSection} id="features">
          <h2 className={styles.sectionTitle}>{t('landing.featuresTitle')}</h2>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h3 className={styles.featureTitle}>{t('landing.feature1Title')}</h3>
              <p className={styles.featureDesc}>{t('landing.feature1Desc')}</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              </div>
              <h3 className={styles.featureTitle}>{t('landing.feature2Title')}</h3>
              <p className={styles.featureDesc}>{t('landing.feature2Desc')}</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <h3 className={styles.featureTitle}>{t('landing.feature3Title')}</h3>
              <p className={styles.featureDesc}>{t('landing.feature3Desc')}</p>
            </div>
          </div>
        </section>

        <section className={styles.howItWorksSection} id="how-it-works">
          <h2 className={styles.sectionTitle}>{t('landing.howTitle')}</h2>
          <div className={styles.stepsContainer}>
            <div className={styles.step}>
              <div className={styles.stepCircle}>1</div>
              <p className={styles.stepLabel}>{t('landing.step1')}</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepCircle}>2</div>
              <p className={styles.stepLabel}>{t('landing.step2')}</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepCircle}>3</div>
              <p className={styles.stepLabel}>{t('landing.step3')}</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepCircle}>4</div>
              <p className={styles.stepLabel}>{t('landing.step4')}</p>
            </div>
          </div>
        </section>
      </main>
      
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>FinShield</div>
            <p className={styles.footerCopy}>{t('landing.footerCopy')}</p>
          </div>
          <div className={styles.footerLinks}>
            <Link to="/privacy">{t('landing.privacy')}</Link>
            <Link to="/terms">{t('landing.terms')}</Link>
            <Link to="/security">{t('landing.security')}</Link>
            <Link to="/methodology">{t('landing.methodology')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
