import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import styles from './AdminUsers.module.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await api.updateAdminUser(id, { is_active: !currentStatus });
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to update user status');
    }
  };

  const changeRole = async (id, newRole) => {
    try {
      await api.updateAdminUser(id, { role: newRole });
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to update user role');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Users</h1>
          <p className={styles.subtitle}>Manage platform users and permissions</p>
        </div>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className={styles.loading}>Loading users...</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.avatar}>{u.full_name ? u.full_name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}</div>
                    <span>{u.full_name || 'No Name Provided'}</span>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>
                  <select 
                    value={u.role} 
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className={styles.roleSelect}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${u.is_active ? styles.active : styles.inactive}`}>
                    {u.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td>
                  <button 
                    className={`${styles.actionBtn} ${u.is_active ? styles.suspendBtn : styles.activateBtn}`}
                    onClick={() => toggleStatus(u.id, u.is_active)}
                  >
                    {u.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
