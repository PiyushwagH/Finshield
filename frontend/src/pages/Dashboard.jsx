import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    return <div className={styles.loading}>Loading Dashboard...</div>;
  }

  if (!latest) {
    return (
      <div className={styles.emptyStateContainer}>
        <div className={styles.emptyStateCard}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <h2>Welcome to FinShield, {user?.full_name || 'User'}!</h2>
          <p>You haven't completed any financial risk assessments yet. Take your first assessment to unlock risk analytics, affordability checks, and tailored recommendations.</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/assessment')}>
            Run First Assessment
          </button>
        </div>
      </div>
    );
  }

  const mappedBand = mapRiskBand(latest.risk_band);
  const defProbPct = (latest.default_probability * 100).toFixed(1);

  // Prepare chart data for line chart
  const chartData = [...history].reverse().map(item => ({
    date: new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: item.risk_score
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome back, {user?.full_name?.split(' ')[0] || 'User'}</h1>
          <p className={styles.subtitle}>Here is your financial risk overview for today.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/assessment')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Run New Assessment
        </button>
      </div>

      {/* Top Cards Row */}
      <div className={styles.topGrid}>
        {/* Main Risk Score Gauge summary */}
        <div className={styles.cardMain}>
          <span className={styles.cardLabel}>Risk Score</span>
          <div className={styles.scoreGaugeBox}>
            <div className={styles.scoreBig}>{latest.risk_score}</div>
            <div className={styles.scoreSub}>/ 850</div>
          </div>
          <div className={styles.bandPillWrapper}>
            <span className={`${styles.bandPill} ${styles['band' + mappedBand]}`}>
              {mappedBand.toUpperCase()} RISK
            </span>
          </div>
          <p className={styles.smallText}>Default Probability: {defProbPct}%</p>
          <p className={styles.dateText}>
            Last updated: {new Date(latest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Metric Cards */}
        <div className={styles.metricCardsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span>Monthly Surplus</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline></svg>
            </div>
            <div className={styles.metricVal}>
              ₹{latest.affordability?.monthly_surplus?.toLocaleString('en-IN') ?? 0}
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span>Emergency Fund</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div className={styles.metricVal}>
              {latest.affordability?.emergency_fund_months ?? 0} Months
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span>EMI to Income Ratio</span>
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
            Action Items
          </h3>
          {latest.advice?.length > 0 ? (
            <div className={styles.actionList}>
              {latest.advice.map((item, idx) => (
                <div key={idx} className={styles.actionRow}>
                  <input type="checkbox" id={`chk-${idx}`} className={styles.checkbox} />
                  <label htmlFor={`chk-${idx}`} className={styles.actionText}>
                    {item.title}
                  </label>
                  <span className={`${styles.prioTag} ${styles['prio' + item.priority]}`}>
                    {item.priority} Priority
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>No action items registered.</p>
          )}
        </div>

        {/* Risk Trend Chart */}
        <div className={styles.card}>
          <div className={styles.cardTitleFlex}>
            <h3 className={styles.sectionTitle}>Your Risk Trend</h3>
            <Link to="/reports" className={styles.linkText}>View History &rarr;</Link>
          </div>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 200, marginTop: '1rem' }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis domain={[300, 850]} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="var(--navy)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={styles.emptyText}>Need more assessments to show trend.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
