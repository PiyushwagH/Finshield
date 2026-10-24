import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import apiClient from '../api/client';
import { mapRiskBand } from '../utils/riskBand';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import styles from './Dashboard.module.css';
import { DashboardSkeleton } from '../components/Skeleton';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, tx, locale } = useLanguage();
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get('/risk/assessments?limit=10');
        if (res.data && res.data.length > 0) {
          setLatest(res.data[0]);
          setHistory(res.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!latest) {
    return (
      <div className={styles.emptyStateContainer}>
        <div className={styles.emptyStateCard}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <h2>{t('dash.welcomeFirst', { name: user?.full_name || t('common.user') })}</h2>
          <p>{t('dash.emptyText')}</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/assessment')}>
            {t('dash.runFirst')}
          </button>
        </div>
      </div>
    );
  }

  const mappedBand = mapRiskBand(latest.final_band || latest.risk_band);
  const defProbPct = (latest.default_probability * 100).toFixed(1);

  // Prepare chart data for line chart
  const chartData = [...history].reverse().map(item => ({
    date: new Date(item.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    score: item.risk_score
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('dash.welcomeBack', { name: user?.full_name?.split(' ')[0] || t('common.user') })}</h1>
          <p className={styles.subtitle}>{t('dash.subtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/assessment')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {t('dash.runNew')}
        </button>
      </div>

      {/* Top Cards Row */}
      <div className={styles.topGrid}>
        {/* Main Risk Score Gauge summary */}
        <div className={styles.cardMain}>
          <span className={styles.cardLabel}>{t('dash.riskScore')}</span>
          <div className={styles.scoreGaugeBox}>
            <div className={styles.scoreBig}>{latest.risk_score}</div>
            <div className={styles.scoreSub}>/ 850</div>
          </div>
          <div className={styles.bandPillWrapper}>
            <span className={`${styles.bandPill} ${styles['band' + mappedBand]}`}>
              {t(`band.${mappedBand}`)}
            </span>
          </div>
          <p className={styles.smallText}>{t('dash.defaultProb', { pct: defProbPct })}</p>
          <p className={styles.dateText}>
            {t('dash.lastUpdated', { date: new Date(latest.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) })}
          </p>
        </div>

        {/* Metric Cards */}
        <div className={styles.metricCardsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span>{t('dash.monthlySurplus')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline></svg>
            </div>
            <div className={styles.metricVal}>
              ₹{latest.affordability?.monthly_surplus?.toLocaleString('en-IN') ?? 0}
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span>{t('dash.emergencyFund')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div className={styles.metricVal}>
              {t('dash.months', { n: latest.affordability?.emergency_fund_months ?? 0 })}
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span>{t('dash.emiRatio')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div className={styles.metricVal}>
              {((latest.affordability?.emi_to_income_ratio || 0) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Action Items & Risk Trend */}
      <div className={styles.middleGrid}>
        {/* Action Items checklist */}
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            {t('dash.actionItems')}
          </h3>
          {latest.advice?.length > 0 ? (
            <div className={styles.actionList}>
              {latest.advice.map((item, idx) => (
                <div key={idx} className={styles.actionRow}>
                  <input type="checkbox" id={`chk-${idx}`} className={styles.checkbox} />
                  <label htmlFor={`chk-${idx}`} className={styles.actionText}>
                    {tx(item.title)}
                  </label>
                  <span className={`${styles.prioTag} ${styles['prio' + item.priority]}`}>
                    {t(`prio.${item.priority}`)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>{t('dash.noActions')}</p>
          )}
        </div>

        {/* Risk Trend Chart */}
        <div className={styles.card}>
          <div className={styles.cardTitleFlex}>
            <h3 className={styles.sectionTitle}>{t('dash.riskTrend')}</h3>
            <Link to="/reports" className={styles.linkText}>{t('dash.viewHistory')}</Link>
          </div>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 200, marginTop: '1rem' }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis domain={[300, 850]} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip formatter={(v) => [v, t('dash.score')]} />
                  <Line type="monotone" dataKey="score" stroke="var(--navy)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={styles.emptyText}>{t('dash.needMore')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
