import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import styles from './Settings.module.css';
import { useLanguage } from '../context/LanguageContext';

const MAX_AVATAR_BYTES = 500 * 1024;

const Settings = () => {
  const { user, logout, setUser } = useAuth();
  const { t } = useLanguage();
  const isAdminPortal = useLocation().pathname.startsWith('/admin');
  const securityLogPath = isAdminPortal ? '/admin/security-log' : '/security-log';
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
      setStatusMsg({ type: 'error', text: t('set.badImage') });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setStatusMsg({ type: 'error', text: t('set.tooLarge') });
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
      setStatusMsg({ type: 'success', text: t('set.updated') });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setStatusMsg({ type: 'error', text: typeof detail === 'string' ? detail : t('set.updateFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('set.title')}</h1>
        <p className={styles.subtitle}>{t('set.subtitle')}</p>
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
        <h2 className={styles.cardTitle}>{t('set.editProfile')}</h2>

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
              {t('set.upload')}
            </label>
            {avatarPreview && (
              <button type="button" className={`${styles.actionBtn} ${styles.dangerBtn}`} style={{ marginLeft: '0.5rem' }} onClick={handleRemovePhoto}>
                {t('set.remove')}
              </button>
            )}
          </div>
        </div>

        <div className={styles.row} style={{ display: 'block', borderBottom: 'none', paddingTop: '1rem' }}>
          <label className={styles.label} style={{ display: 'block', marginBottom: '0.4rem' }}>{t('set.fullName')}</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={styles.textInput}
          />
        </div>

        <div className={styles.row} style={{ display: 'block', borderBottom: 'none' }}>
          <label className={styles.label} style={{ display: 'block', marginBottom: '0.4rem' }}>{t('set.phone')}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={styles.textInput}
            placeholder={t('set.optional')}
          />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>{t('set.email')}</span>
          <span className={styles.value}>{user?.email}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('set.role')}</span>
          <span className={styles.value}>{user?.role === 'admin' ? t('set.admin') : t('set.user')}</span>
        </div>

        <button type="submit" className={styles.actionBtn} disabled={saving} style={{ marginTop: '1rem' }}>
          {saving ? t('set.saving') : t('set.save')}
        </button>
      </form>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{t('set.password')}</h2>
        <p className={styles.label} style={{ marginBottom: '1rem' }}>
          {t('set.passwordText')}
        </p>
        <Link to="/forgot-password" className={styles.actionBtn}>{t('set.sendReset')}</Link>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{t('set.session')}</h2>
        <p className={styles.label} style={{ marginBottom: '1rem' }}>
          {t('set.sessionPre')}<Link to={securityLogPath}>{t('sec.title')}</Link>{t('set.sessionPost')}
        </p>
        <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={logout}>
          {t('set.logout')}
        </button>
      </div>
    </div>
  );
};

export default Settings;
