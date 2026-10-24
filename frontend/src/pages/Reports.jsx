import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { mapRiskBand } from '../utils/riskBand';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import styles from './Reports.module.css';
import { useLanguage } from '../context/LanguageContext';
import { ListPageSkeleton } from '../components/Skeleton';

const Reports = () => {
  const navigate = useNavigate();
  const { t, tx, locale } = useLanguage();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await apiClient.get('/risk/assessments?limit=50');
        setAssessments(res.data);
      } catch (err) {
        setError(t('rep.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  if (loading) return <ListPageSkeleton count={3} />;
  if (error) return <div className={styles.error}>{error}</div>;

  const chartData = [...assessments].reverse().map(item => ({
    date: new Date(item.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    score: item.risk_score
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('rep.title')}</h1>
          <p className={styles.subtitle}>{t('rep.subtitle', { n: assessments.length })}</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/assessment')}>
          {t('rep.newAssessment')}
        </button>
      </div>

      {/* Risk Score Over Time Chart */}
      <div className={styles.card}>
        <div className={styles.chartHeader}>
          <h3 className={styles.cardTitle}>{t('rep.overTime')}</h3>
          <div className={styles.legend}>
            <span className={styles.legendLow}>{t('rep.low')}</span>
            <span className={styles.legendMed}>{t('rep.medium')}</span>
            <span className={styles.legendHigh}>{t('rep.high')}</span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: 260, marginTop: '1rem' }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                <YAxis domain={[300, 850]} stroke="var(--text-muted)" fontSize={12} />
                <Tooltip formatter={(v) => [v, t('dash.score')]} />
                <Line type="monotone" dataKey="score" stroke="var(--teal)" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={styles.emptyText}>{t('rep.noHistory')}</p>
        )}
      </div>

      {/* Assessment History Table */}
      <div className={styles.card} style={{ marginTop: '1.5rem' }}>
        <h3 className={styles.cardTitle}>{t('rep.history')}</h3>
        {assessments.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('rep.colDate')}</th>
                  <th>{t('rep.colScore')}</th>
                  <th>{t('rep.colBand')}</th>
                  <th>{t('rep.colProb')}</th>
                  <th>{t('rep.colIncome')}</th>
                  <th>{t('rep.colAfford')}</th>
                  <th>{t('rep.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map(item => {
                  const mappedBand = mapRiskBand(item.risk_band);
                  const income = item.input_data?.annual_income;
                  return (
                    <tr key={item.id}>
                      <td>{new Date(item.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td><strong>{item.risk_score}</strong></td>
                      <td>
                        <span className={`${styles.bandBadge} ${styles['band' + mappedBand]}`}>
                          {t(`band.word.${mappedBand}`)}
                        </span>
                      </td>
                      <td>{(item.default_probability * 100).toFixed(1)}%</td>
                      <td>{income ? `₹${Number(income).toLocaleString('en-IN')}` : '—'}</td>
                      <td>
                        <span className={styles.gradeBadge}>{item.affordability?.grade ? tx(item.affordability.grade) : '—'}</span>
                      </td>
                      <td>
                        <button
                          className={styles.actionBtn}
                          onClick={() => navigate(`/assessment/result/${item.id}`)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          {t('rep.view')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyText}>{t('rep.none')}</p>
        )}
      </div>
    </div>
  );
};

export default Reports;
