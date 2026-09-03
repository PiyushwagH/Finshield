import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import styles from './SchemeQuickCheck.module.css';

const SchemeQuickCheck = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [formData, setFormData] = useState({
    age: '',
    gender: 'female',
    state: 'Maharashtra',
    area_type: 'urban',
    annual_income: '',
    occupation_tags: []
  });

  const availableTags = [
    { id: 'farmer', label: 'Farmer / Agriculture' },
    { id: 'student', label: 'Student' },
    { id: 'sc_st', label: 'SC / ST' },
    { id: 'business_owner', label: 'Business Owner' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tagId) => {
    setFormData(prev => {
      const tags = [...prev.occupation_tags];
      if (tags.includes(tagId)) {
        return { ...prev, occupation_tags: tags.filter(t => t !== tagId) };
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
        annual_income: formData.annual_income ? Number(formData.annual_income) : null
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
            &larr; Back to form
          </button>
          <h1 className={styles.title}>Your Matches</h1>
          <p className={styles.subtitle}>Based on your quick profile, you might qualify for these schemes.</p>
        </div>

        <div className={styles.resultsGrid}>
          {results.filter(r => r.eligibility.is_eligible).length === 0 ? (
            <div className={styles.emptyState}>No exact matches found for your profile. Try a full assessment.</div>
          ) : (
            results.filter(r => r.eligibility.is_eligible).map((item, idx) => (
              <div key={idx} className={styles.resultCard}>
                <div className={styles.cardHeader}>
                  <h3>{item.scheme.name}</h3>
                  <span className={styles.matchBadge}>Match</span>
                </div>
                <p className={styles.desc}>{item.scheme.short_description}</p>
                <button className={styles.viewBtn} onClick={() => navigate(`/schemes/${item.scheme.slug}`)}>
                  View Details
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
          &larr; Back to Schemes
        </button>
        <h1 className={styles.title}>Quick Eligibility Check</h1>
        <p className={styles.subtitle}>Find out which schemes you qualify for in under 2 minutes without creating an account.</p>
      </div>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label>Age <span className={styles.required}>*</span></label>
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
            <label>Gender</label>
            <select name="gender" value={formData.gender} onChange={handleInputChange}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label>State</label>
            <select name="state" value={formData.state} onChange={handleInputChange}>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Delhi">Delhi</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label>Area Type</label>
            <select name="area_type" value={formData.area_type} onChange={handleInputChange}>
              <option value="urban">Urban</option>
              <option value="rural">Rural</option>
            </select>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label>Annual Income (Optional)</label>
          <input 
            type="number" 
            name="annual_income" 
            placeholder="e.g. 300000"
            value={formData.annual_income} 
            onChange={handleInputChange} 
          />
          <span className={styles.hintText}>Providing income helps match you with income-based subsidies.</span>
        </div>

        <div className={styles.inputGroup}>
          <label>Occupation / Categories</label>
          <div className={styles.tagsGrid}>
            {availableTags.map(tag => (
              <div 
                key={tag.id}
                className={`${styles.tagOption} ${formData.occupation_tags.includes(tag.id) ? styles.tagActive : ''}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.label}
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Finding matches...' : 'Check My Eligibility'}
        </button>
      </form>
    </div>
  );
};

export default SchemeQuickCheck;
