import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import styles from './ManageSchemes.module.css';
import { TableRowsSkeleton } from '../../components/Skeleton';
import SchemeEditorDrawer from './SchemeEditorDrawer';

const ManageSchemes = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(null);

  // Actions dropdown & confirmation modal states
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [schemeToDelete, setSchemeToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminSchemes();
      setSchemes(res.data);
    } catch (err) {
      console.error('Failed to fetch admin schemes', err);
      showToast('Failed to load schemes list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes();
  }, []);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeMenuId && !e.target.closest(`.${styles.actionCell}`)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeMenuId]);

  const handleEdit = async (slug) => {
    try {
      setActiveMenuId(null);
      const res = await api.getAdminSchemeDetail(slug);
      setSelectedScheme(res.data);
      setEditorOpen(true);
    } catch (err) {
      console.error(err);
      showToast('Failed to load scheme details.', 'error');
    }
  };

  const handleAddNew = () => {
    setActiveMenuId(null);
    setSelectedScheme(null);
    setEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setSelectedScheme(null);
    fetchSchemes(); // Refresh list after edit
  };

  const handleToggleStatus = async (scheme, targetStatus) => {
    try {
      setActiveMenuId(null);
      await api.updateAdminSchemeStatus(scheme.id, targetStatus);
      if (targetStatus === 'archived') {
        showToast(`"${scheme.name}" is now inactive and hidden from users.`);
      } else if (targetStatus === 'active') {
        showToast(`"${scheme.name}" is now active and published for users.`);
      } else {
        showToast(`Status updated to ${targetStatus}.`);
      }
      fetchSchemes();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to update scheme status.';
      showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    }
  };

  const confirmDeleteScheme = async () => {
    if (!schemeToDelete) return;
    try {
      setDeleteLoading(true);
      await api.deleteScheme(schemeToDelete.id, true);
      showToast(`Scheme "${schemeToDelete.name}" was permanently removed.`);
      setSchemeToDelete(null);
      fetchSchemes();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to delete scheme.';
      showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.importSchemes(formData);
      fetchSchemes();
      const parts = [`${data.imported} imported as "Needs Review"`];
      if (data.skipped?.length) parts.push(`${data.skipped.length} skipped (already exist)`);
      if (data.errors?.length) {
        parts.push(`${data.errors.length} rejected`);
        console.warn('Rejected CSV rows:', data.errors);
      }
      showToast(parts.join(', ') + '.', data.errors?.length ? 'error' : 'success');
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.detail || 'Import failed. Please check the CSV file format.', 'error');
    } finally {
      // Allow re-selecting the same file after fixing it.
      e.target.value = '';
    }
  };

  const filteredSchemes = schemes.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || (s.category && s.category.toLowerCase() === selectedCategory.toLowerCase());
    const matchesLevel = selectedLevel === 'all' || (s.level && s.level.toLowerCase() === selectedLevel.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || (s.status && s.status.toLowerCase() === selectedStatus.toLowerCase());
    return matchesSearch && matchesCategory && matchesLevel && matchesStatus;
  });

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
          
          <select 
            className={styles.filterSelect}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="agriculture">Agriculture</option>
            <option value="education">Education</option>
            <option value="health">Health</option>
            <option value="business">Business</option>
            <option value="welfare">Welfare</option>
            <option value="housing">Housing</option>
          </select>
          
          <select 
            className={styles.filterSelect}
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="central">Central</option>
            <option value="state">State</option>
          </select>
          
          <select 
            className={styles.filterSelect}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="archived">Inactive (Archived)</option>
            <option value="needs_review">Needs Review</option>
            <option value="draft">Draft</option>
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
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowsSkeleton rows={6} cols={7} />
            ) : filteredSchemes.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No schemes found matching the selected filters.
                </td>
              </tr>
            ) : filteredSchemes.map(s => {
              const isMenuActive = activeMenuId === s.id;
              const isActive = s.status === 'active';

              return (
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
                  <td>
                    {(s.benefit_amount_inr || s.benefit_amount)
                      ? `₹${Number(s.benefit_amount_inr || s.benefit_amount).toLocaleString('en-IN')}${s.benefit_period === 'monthly' ? '/mo' : s.benefit_period === 'yearly' ? '/yr' : ''}`
                      : (s.benefit_type ? s.benefit_type.replace('_', ' ') : 'Varies')}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[s.status] || ''}`}>
                      {s.status === 'active' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
                      {s.status === 'needs_review' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>}
                      {s.status === 'archived' ? 'Inactive' : s.status.replace('_', ' ').charAt(0).toUpperCase() + s.status.replace('_', ' ').slice(1)}
                    </span>
                  </td>
                  <td>
                    {s.last_verified_at
                      ? new Date(s.last_verified_at).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
                      : s.last_synced_at
                        ? new Date(s.last_synced_at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
                        : '-'}
                  </td>
                  <td className={styles.actionCell}>
                    <button 
                      className={`${styles.iconBtn} ${isMenuActive ? styles.iconBtnActive : ''}`} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuActive ? null : s.id);
                      }}
                      title="Scheme actions"
                      aria-label={`Actions for ${s.name}`}
                      aria-expanded={isMenuActive}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </button>

                    {isMenuActive && (
                      <div className={styles.actionMenu} role="menu">
                        <button 
                          className={styles.actionMenuItem} 
                          onClick={() => handleEdit(s.slug)}
                          role="menuitem"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                          Edit Details
                        </button>

                        {isActive ? (
                          <button 
                            className={styles.actionMenuItem} 
                            onClick={() => handleToggleStatus(s, 'archived')}
                            role="menuitem"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            Make Inactive
                          </button>
                        ) : (
                          <button 
                            className={styles.actionMenuItem} 
                            onClick={() => handleToggleStatus(s, 'active')}
                            role="menuitem"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Make Active
                          </button>
                        )}

                        <div className={styles.menuDivider} />

                        <button 
                          className={`${styles.actionMenuItem} ${styles.actionMenuItemDanger}`} 
                          onClick={() => {
                            setActiveMenuId(null);
                            setSchemeToDelete(s);
                          }}
                          role="menuitem"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          Delete Scheme
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editorOpen && (
        <SchemeEditorDrawer 
          scheme={selectedScheme} 
          onClose={handleCloseEditor} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {schemeToDelete && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="delete-scheme-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 id="delete-scheme-title" className={styles.modalTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--risk-high)" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                Delete Scheme
              </h3>
              <button 
                className={styles.modalCloseBtn} 
                onClick={() => setSchemeToDelete(null)}
                disabled={deleteLoading}
                aria-label="Close dialog"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <p>
                Are you sure you want to permanently delete <strong>{schemeToDelete.name}</strong>?
              </p>
              <div className={styles.modalWarning}>
                <strong>Warning:</strong> This will completely remove the scheme from the database, matching algorithms, user assessments, and the public catalog. This action cannot be undone.
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={styles.modalCancelBtn} 
                onClick={() => setSchemeToDelete(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className={styles.modalDeleteBtn} 
                onClick={confirmDeleteScheme}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  'Deleting...'
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`} role="status">
          {toast.type === 'error' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default ManageSchemes;
