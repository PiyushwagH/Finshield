import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import styles from './AdminDashboard.module.css';
import { DashboardSkeleton } from '../../components/Skeleton';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, analyticsRes] = await Promise.all([
          api.getAdminStats(),
          api.getAdminAnalytics()
        ]);
        setStats(statsRes.data);
        setAnalytics(analyticsRes.data);
      } catch (err) {
        console.error('Failed to load admin dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (loading) return <DashboardSkeleton label="Loading admin dashboard" />;

  const COLORS = ['#16A34A', '#F59E0B', '#DC2626']; // Low, Medium, High

  const riskData = analytics?.risk_distribution ? [
    { name: 'Low Risk', value: analytics.risk_distribution.low },
    { name: 'Medium Risk', value: analytics.risk_distribution.medium },
    { name: 'High Risk', value: analytics.risk_distribution.high }
  ] : [];

  return (
    <div className={styles.container}>
      {stats?.pending_updates > 0 && (
        <div className={styles.alertBanner}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          {stats.pending_updates} schemes have changed eligibility criteria on official portals and need review.
          <button className={styles.reviewBtn}>Review Now</button>
        </div>
      )}

      <h2 className={styles.sectionTitle}>System Overview</h2>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Total Users</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div className={styles.statValue}>{stats?.total_users.toLocaleString()}</div>
          <div className={styles.statTrend}>+5.2% this month</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Assessments This Month</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          </div>
          <div className={styles.statValue}>{stats?.assessments_this_month.toLocaleString()}</div>
          <div className={styles.statTrend}>+12% this month</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Active Schemes</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="9 15 11 17 15 13"></polyline></svg>
          </div>
          <div className={styles.statValue}>{stats?.active_schemes}</div>
          <div className={styles.statSub}>Across 12 categories</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Pending Updates</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.alertIcon}><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
          </div>
          <div className={`${styles.statValue} ${styles.alertValue}`}>{stats?.pending_updates}</div>
          <div className={`${styles.statSub} ${styles.alertSub}`}>Requires admin review</div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <h3>Assessments Per Day</h3>
            <span className={styles.timeRange}>Last 30 Days</span>
          </div>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics?.assessments_per_day}>
                <XAxis dataKey="date" tick={{fontSize: 12, fill: '#5B6B7F'}} tickFormatter={(v) => new Date(v).getDate()} />
                <Tooltip cursor={{fill: '#F7F9FC'}} />
                <Bar dataKey="count" fill="#E2E8F0" radius={[4, 4, 0, 0]} 
                     activeBar={{ fill: '#0F2A47' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className={styles.chartCard}>
          <h3>User Risk Distribution</h3>
          <div className={styles.pieWrapper}>
             <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.pieCenter}>
               <strong>12.4k</strong>
               <span>Total</span>
            </div>
          </div>
          <div className={styles.legend}>
             {riskData.map((item, idx) => (
                <div key={idx} className={styles.legendItem}>
                   <span className={styles.dot} style={{backgroundColor: COLORS[idx]}}></span>
                   <span className={styles.legendLabel}>{item.name}</span>
                   <span className={styles.legendValue}>{item.value}%</span>
                </div>
             ))}
          </div>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <div className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <h3>Most Recommended Schemes</h3>
            <button className={styles.linkBtn}>View All</button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Scheme</th>
                <th>Category</th>
                <th>Recommended</th>
                <th>Applied</th>
                <th>Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.most_recommended.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.scheme}</td>
                  <td><span className={styles.categoryPill}>{item.category}</span></td>
                  <td>{item.recommended.toLocaleString()}</td>
                  <td>{item.applied.toLocaleString()}</td>
                  <td className={item.conv_rate > 50 ? styles.highConv : ''}>{item.conv_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className={styles.activityCard}>
          <h3>Recent Activity</h3>
          <div className={styles.activityList}>
             <div className={styles.activityItem}>
                <div className={styles.actIcon}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>
                <div className={styles.actContent}>
                   <p>Scheme updated: Rent Assistance</p>
                   <span>by Admin J.Smith • 10m ago</span>
                </div>
             </div>
             <div className={styles.activityItem}>
                <div className={styles.actIcon}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg></div>
                <div className={styles.actContent}>
                   <p>New Support Agent onboarded</p>
                   <span>by System Auto • 1h ago</span>
                </div>
             </div>
             <div className={styles.activityItem}>
                <div className={`${styles.actIcon} ${styles.dangerAct}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>
                <div className={styles.actContent}>
                   <p>Flagged account suspended</p>
                   <span>by Admin J.Smith • 3h ago</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
