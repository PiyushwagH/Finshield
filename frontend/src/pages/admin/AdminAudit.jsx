import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import styles from './AdminAudit.module.css';
import { TableRowsSkeleton } from '../../components/Skeleton';

const AdminAudit = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminAuditLogs();
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Log</h1>
          <p className={styles.subtitle}>System-wide activity and security events</p>
        </div>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowsSkeleton rows={6} cols={6} />
            ) : logs.length === 0 ? (
              <tr><td colSpan="6" className={styles.empty}>No audit logs found.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id}>
                <td className={styles.timeCell}>{new Date(log.created_at).toLocaleString()}</td>
                <td><span className={styles.actionPill}>{log.action}</span></td>
                <td><span className={styles.entityPill}>{log.entity_type}</span></td>
                <td className={styles.monoCell}>{log.entity_id}</td>
                <td>{log.actor_email}</td>
                <td className={styles.detailsCell}>
                  {log.changes ? JSON.stringify(log.changes).substring(0, 50) + '...' : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAudit;
