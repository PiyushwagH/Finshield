import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import styles from './SchemeQuickCheck.module.css';
import { useLanguage } from '../context/LanguageContext';

// Values must match scheme rule values exactly (they're compared as strings).
const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];
const EMPLOYMENT = ['salaried_private', 'salaried_government', 'self_employed', 'business_owner', 'student', 'retired', 'unemployed', 'homemaker'];
const TAGS = ['farmer', 'fisheries', 'sc_st', 'obc', 'minority', 'disabled', 'street_vendor', 'artisan', 'construction_worker'];

const SchemeQuickCheck = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [formData, setFormData] = useState({
    age: '',
    gender: 'female',
    state: 'Maharashtra',
    area_type: 'urban',
    employment_status: '',
    annual_income: '',
    occupation_tags: []
  });


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tagId) => {
    setFormData(prev => {
      const tags = [...prev.occupation_tags];
      if (tags.includes(tagId)) {
        return { ...prev, occupation_tags: tags.filter(x => x !== tagId) };
      }
      return { ...prev, occupation_tags: [...tags, tagId] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        age: Number(formData.age) || 30,
        annual_income: formData.annual_income ? Number(formData.annual_income) : null,
        employment_status: formData.employment_status || null,
      };
      const res = await api.quickMatchSchemes(payload);
      setResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (results) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setResults(null)}>
            {t('quick.backToForm')}
          </button>
          <h1 className={styles.title}>{t('quick.matchesTitle')}</h1>
          <p className={styles.subtitle}>{t('quick.matchesSubtitle')}</p>
        </div>

        <div className={styles.resultsGrid}>
          {results.filter(r => r.eligibility.is_eligible).length === 0 ? (
            <div className={styles.emptyState}>{t('quick.noMatches')}</div>
          ) : (
            results.filter(r => r.eligibility.is_eligible).map((item, idx) => (
              <div key={idx} className={styles.resultCard}>
                <div className={styles.cardHeader}>
                  <h3>{item.scheme.name}</h3>
                  <span className={styles.matchBadge}>{t('quick.match')}</span>
                </div>
                <p className={styles.desc}>{item.scheme.short_description}</p>
                <button className={styles.viewBtn} onClick={() => navigate(`/schemes/${item.scheme.slug}`)}>
                  {t('quick.viewDetails')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/schemes')}>
          {t('quick.backToSchemes')}
        </button>
        <h1 className={styles.title}>{t('quick.title')}</h1>
        <p className={styles.subtitle}>{t('quick.subtitle')}</p>
      </div>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label>{t('quick.age')} <span className={styles.required}>*</span></label>
            <input 
              type="number" 
              name="age" 
              value={formData.age} 
              onChange={handleInputChange} 
              required
              min="18"
              max="100"
            />
          </div>
          <div className={styles.inputGroup}>
            <label>{t('quick.gender')}</label>
            <select name="gender" value={formData.gender} onChange={handleInputChange}>
              <option value="male">{t('opt.male')}</option>
              <option value="female">{t('opt.female')}</option>
              <option value="other">{t('opt.other')}</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label>{t('quick.state')}</label>
            <select name="state" value={formData.state} onChange={handleInputChange}>
              {STATES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label>{t('quick.area')}</label>
            <select name="area_type" value={formData.area_type} onChange={handleInputChange}>
              <option value="urban">{t('quick.urban')}</option>
              <option value="rural">{t('quick.rural')}</option>
            </select>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label>{t('quick.employment')}</label>
          <select name="employment_status" value={formData.employment_status} onChange={handleInputChange}>
            <option value="">{t('wiz.select')}</option>
            {EMPLOYMENT.map((e) => <option key={e} value={e}>{t(`opt.${e}`)}</option>)}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>{t('quick.income')}</label>
          <input 
            type="number" 
            name="annual_income" 
            placeholder={t('quick.incomePlaceholder')}
            value={formData.annual_income} 
            onChange={handleInputChange} 
          />
          <span className={styles.hintText}>{t('quick.incomeHint')}</span>
        </div>

        <div className={styles.inputGroup}>
          <label>{t('quick.categories')}</label>
          <div className={styles.tagsGrid}>
            {TAGS.map(tag => (
              <button
                type="button"
                key={tag}
                aria-pressed={formData.occupation_tags.includes(tag)}
                className={`${styles.tagOption} ${formData.occupation_tags.includes(tag) ? styles.tagActive : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {t(`tag.${tag}`)}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? t('quick.finding') : t('quick.check')}
        </button>
      </form>
    </div>
  );
};

export default SchemeQuickCheck;
