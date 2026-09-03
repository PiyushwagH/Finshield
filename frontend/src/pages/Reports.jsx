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

const Reports = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await apiClient.get('/risk/assessments?limit=50');
        setAssessments(res.data);
      } catch (err) {
        setError('Failed to load reports history.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  if (loading) return <div className={styles.loading}>Loading Reports...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const chartData = [...assessments].reverse().map(item => ({
    date: new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: item.risk_score
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Reports</h1>
          <p className={styles.subtitle}>Showing history of {assessments.length} complete assessments</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/assessment')}>
          + New Assessment
        </button>
      </div>

      {/* Risk Score Over Time Chart */}
      <div className={styles.card}>
        <div className={styles.chartHeader}>
          <h3 className={styles.cardTitle}>Risk Score Over Time</h3>
          <div className={styles.legend}>
            <span className={styles.legendLow}>● Low</span>
            <span className={styles.legendMed}>● Medium</span>
            <span className={styles.legendHigh}>● High</span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: 260, marginTop: '1rem' }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                <YAxis domain={[300, 850]} stroke="var(--text-muted)" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="var(--teal)" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={styles.emptyText}>No assessment history available yet.</p>
        )}
      </div>

      {/* Assessment History Table */}
      <div className={styles.card} style={{ marginTop: '1.5rem' }}>
        <h3 className={styles.cardTitle}>Assessment History</h3>
        {assessments.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Risk Score</th>
                  <th>Risk Band</th>
                  <th>Default Prob.</th>
                  <th>Annual Income</th>
                  <th>Affordability</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map(item => {
                  const mappedBand = mapRiskBand(item.risk_band);
                  const income = item.input_data?.annual_income;
                  return (
                    <tr key={item.id}>
                      <td>{new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td>
                      <td><strong>{item.risk_score}</strong></td>
                      <td>
                        <span className={`${styles.bandBadge} ${styles['band' + mappedBand]}`}>
                          {mappedBand}
                        </span>
                      </td>
                      <td>{(item.default_probability * 100).toFixed(1)}%</td>
                      <td>{income ? `₹${income.toLocaleString('en-IN')}` : 'N/A'}</td>
                      <td>
                        <span className={styles.gradeBadge}>{item.affordability?.grade || 'N/A'}</span>
                      </td>
                      <td>
                        <button
                          className={styles.actionBtn}
                          onClick={() => navigate(`/assessment/result/${item.id}`)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          View Report
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyText}>No past assessments found.</p>
        )}
      </div>
    </div>
  );
};

export default Reports;
