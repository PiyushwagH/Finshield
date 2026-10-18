import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import styles from './Settings.module.css';

const MAX_AVATAR_BYTES = 500 * 1024;

const Settings = () => {
  const { user, logout, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_data || null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMsg({ type: 'error', text: 'Please choose an image file.' });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setStatusMsg({ type: 'error', text: 'Image is too large. Please choose one under 500KB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const payload = { full_name: fullName, phone };
      // Only send avatar_data if it actually changed (undefined -> omitted
      // by the backend's exclude_unset, so an untouched photo is left alone).
      if (avatarPreview !== (user?.avatar_data || null)) {
        payload.avatar_data = avatarPreview || '';
      }
      const res = await api.updateProfile(payload);
      setUser(res.data);
      setStatusMsg({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setStatusMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your profile, photo, and account security.</p>
      </div>

      {statusMsg && (
        <div
          className={styles.toast}
          style={{ backgroundColor: statusMsg.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: statusMsg.type === 'success' ? '#065F46' : 'var(--risk-high)' }}
        >
          {statusMsg.text}
        </div>
      )}

      <form className={styles.card} onSubmit={handleSaveProfile}>
        <h2 className={styles.cardTitle}>Edit Profile</h2>

        <div className={styles.avatarRow}>
          <div className={styles.avatarPreview}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile" className={styles.avatarImg} />
            ) : (
              <span>{user?.full_name?.charAt(0) || 'U'}</span>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
              id="avatar-upload"
            />
            <label htmlFor="avatar-upload" className={styles.actionBtn} style={{ cursor: 'pointer', display: 'inline-block' }}>
              Upload Photo
            </label>
            {avatarPreview && (
              <button type="button" className={`${styles.actionBtn} ${styles.dangerBtn}`} style={{ marginLeft: '0.5rem' }} onClick={handleRemovePhoto}>
                Remove
              </button>
            )}
          </div>
        </div>

        <div className={styles.row} style={{ display: 'block', borderBottom: 'none', paddingTop: '1rem' }}>
          <label className={styles.label} style={{ display: 'block', marginBottom: '0.4rem' }}>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={styles.textInput}
          />
        </div>

        <div className={styles.row} style={{ display: 'block', borderBottom: 'none' }}>
          <label className={styles.label} style={{ display: 'block', marginBottom: '0.4rem' }}>Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={styles.textInput}
            placeholder="Optional"
          />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Email</span>
          <span className={styles.value}>{user?.email}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Role</span>
          <span className={styles.value}>{user?.role === 'admin' ? 'Administrator' : 'User'}</span>
        </div>

        <button type="submit" className={styles.actionBtn} disabled={saving} style={{ marginTop: '1rem' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Password</h2>
        <p className={styles.label} style={{ marginBottom: '1rem' }}>
          Reset your password via the email-based reset flow used for sign-in.
        </p>
        <Link to="/forgot-password" className={styles.actionBtn}>Send reset link</Link>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Session</h2>
        <p className={styles.label} style={{ marginBottom: '1rem' }}>
          Review active sessions on the <Link to="/security-log">Security Log</Link> page, or sign out of this device now.
        </p>
        <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
};

export default Settings;
