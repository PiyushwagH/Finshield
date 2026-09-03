import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import styles from './ManageSchemes.module.css';
import SchemeEditorDrawer from './SchemeEditorDrawer';

const ManageSchemes = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(null);

  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminSchemes();
      setSchemes(res.data);
    } catch (err) {
      console.error('Failed to fetch admin schemes', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (slug) => {
    try {
      const res = await api.getSchemeDetail(slug);
      setSelectedScheme(res.data);
      setEditorOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNew = () => {
    setSelectedScheme(null);
    setEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setSelectedScheme(null);
    fetchSchemes(); // Refresh list after edit
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await api.importSchemes(formData);
      fetchSchemes();
      alert('Schemes imported successfully!');
    } catch (err) {
      console.error(err);
      alert('Import failed.');
    }
  };

  const filteredSchemes = schemes.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Manage Schemes</h1>
          <p className={styles.subtitle}>Configure, review, and publish welfare parameters.</p>
        </div>
        <div className={styles.actions}>
          <label className={styles.importBtn}>
            <input type="file" accept=".csv" onChange={handleImport} style={{display:'none'}} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            Import from CSV
          </label>
          <button className={styles.addBtn} onClick={handleAddNew}>
            + Add New Scheme
          </button>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableToolbar}>
          <div className={styles.searchBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              placeholder="Search schemes by name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select className={styles.filterSelect}>
            <option>All Categories</option>
            <option>Agriculture</option>
            <option>Welfare</option>
            <option>Housing</option>
          </select>
          
          <select className={styles.filterSelect}>
            <option>All Levels</option>
            <option>Central</option>
            <option>State</option>
          </select>
          
          <select className={styles.filterSelect}>
            <option>All Statuses</option>
            <option>Active</option>
            <option>Needs Review</option>
            <option>Draft</option>
          </select>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Scheme Name</th>
              <th>Category</th>
              <th>Benefit Amount</th>
              <th>Status</th>
              <th>Last Synced</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className={styles.loading}>Loading...</td></tr>
            ) : filteredSchemes.map(s => (
              <tr key={s.id} className={s.status === 'needs_review' ? styles.rowNeedsReview : ''}>
                <td><input type="checkbox" /></td>
                <td>
                  <div className={styles.nameCell}>
                    {s.status === 'needs_review' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--risk-medium)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    )}
                    {s.name}
                  </div>
                </td>
                <td>{s.category ? s.category.charAt(0).toUpperCase() + s.category.slice(1) : '-'}</td>
                <td>{s.benefit_amount ? `₹${s.benefit_amount.toLocaleString()}` : 'Varies'}</td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[s.status]}`}>
                    {s.status === 'active' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
                    {s.status === 'needs_review' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>}
                    {s.status.replace('_', ' ').charAt(0).toUpperCase() + s.status.replace('_', ' ').slice(1)}
                  </span>
                </td>
                <td>
                  {s.last_synced_at ? new Date(s.last_synced_at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '-'}
                </td>
                <td>
                  <button className={styles.iconBtn} onClick={() => handleEdit(s.slug)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editorOpen && (
        <SchemeEditorDrawer 
          scheme={selectedScheme} 
          onClose={handleCloseEditor} 
        />
      )}
    </div>
  );
};

export default ManageSchemes;
