import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import styles from './SchemeEditorDrawer.module.css';

const operators = [
  { value: 'eq', label: 'Equals (==)' },
  { value: 'neq', label: 'Not Equals (!=)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'lte', label: 'Less Than or Equal (<=)' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'gte', label: 'Greater Than or Equal (>=)' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
  { value: 'between', label: 'Between' }
];

const SchemeEditorDrawer = ({ scheme, onClose }) => {
  const isEditing = !!scheme;
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    short_description: '',
    ministry: '',
    category: 'welfare',
    level: 'central',
    benefit_type: 'cash',
    benefit_amount: '',
    status: 'draft',
    rules: []
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setFormData({
        name: scheme.name || '',
        slug: scheme.slug || '',
        short_description: scheme.short_description || '',
        ministry: scheme.ministry || '',
        category: scheme.category || 'welfare',
        level: scheme.level || 'central',
        benefit_type: scheme.benefit_type || 'cash',
        benefit_amount: scheme.benefit_amount || '',
        status: scheme.status || 'draft',
        rules: scheme.rules || []
      });
    }
  }, [scheme, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddRule = () => {
    setFormData(prev => ({
      ...prev,
      rules: [
        ...prev.rules, 
        { field: '', operator: 'eq', value: '', logic_group: 1 }
      ]
    }));
  };

  const handleRuleChange = (index, field, value) => {
    const newRules = [...formData.rules];
    if (field === 'value' && (newRules[index].operator === 'in' || newRules[index].operator === 'not_in')) {
       // Just keep it as string in UI, parse to array on submit if needed
       newRules[index][field] = value;
    } else {
       newRules[index][field] = value;
    }
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const handleRemoveRule = (index) => {
    const newRules = [...formData.rules];
    newRules.splice(index, 1);
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Process rules before sending
    const processedRules = formData.rules.map(r => {
       let parsedValue = r.value;
       if ((r.operator === 'in' || r.operator === 'not_in') && typeof r.value === 'string') {
          parsedValue = r.value.split(',').map(s => s.trim());
       } else if (r.operator === 'between' && typeof r.value === 'string') {
          parsedValue = r.value.split(',').map(s => Number(s.trim()));
       } else if (!isNaN(Number(r.value)) && r.value !== '') {
          parsedValue = Number(r.value);
       }
       
       return {
          ...r,
          value: parsedValue,
          logic_group: Number(r.logic_group) || 1
       };
    });
    
    const payload = {
      ...formData,
      benefit_amount: formData.benefit_amount ? Number(formData.benefit_amount) : null,
      rules: processedRules
    };
    
    try {
      if (isEditing) {
        await api.updateScheme(scheme.id, payload);
      } else {
        await api.createScheme(payload);
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save scheme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <h2>{isEditing ? 'Edit Scheme' : 'Add New Scheme'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className={styles.drawerBody}>
          <form id="scheme-form" onSubmit={handleSubmit}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Basic Information</h3>
              
              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label>Scheme Name *</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleChange} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Slug *</label>
                  <input type="text" name="slug" required value={formData.slug} onChange={handleChange} disabled={isEditing} />
                </div>
              </div>
              
              <div className={styles.inputGroup}>
                <label>Short Description</label>
                <textarea name="short_description" rows="2" value={formData.short_description} onChange={handleChange}></textarea>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label>Ministry / Department</label>
                  <input type="text" name="ministry" value={formData.ministry} onChange={handleChange} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Category</label>
                  <select name="category" value={formData.category} onChange={handleChange}>
                    <option value="agriculture">Agriculture</option>
                    <option value="education">Education</option>
                    <option value="health">Health</option>
                    <option value="business">Business</option>
                    <option value="welfare">Welfare</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label>Level</label>
                  <select name="level" value={formData.level} onChange={handleChange}>
                    <option value="central">Central</option>
                    <option value="state">State</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="needs_review">Needs Review</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Eligibility Rules</h3>
                <button type="button" className={styles.addRuleBtn} onClick={handleAddRule}>
                  + Add Rule
                </button>
              </div>
              <p className={styles.helpText}>Rules in the same Group ID are evaluated with AND. Different Group IDs use OR.</p>
              
              <div className={styles.rulesList}>
                {formData.rules.map((rule, idx) => (
                  <div key={idx} className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <span className={styles.ruleNum}>Rule {idx + 1}</span>
                      <button type="button" className={styles.removeRuleBtn} onClick={() => handleRemoveRule(idx)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                    <div className={styles.ruleBody}>
                      <div className={styles.ruleInput}>
                        <label>Field Name</label>
                        <input type="text" placeholder="e.g. annual_income" value={rule.field} onChange={(e) => handleRuleChange(idx, 'field', e.target.value)} required />
                      </div>
                      <div className={styles.ruleInput}>
                        <label>Operator</label>
                        <select value={rule.operator} onChange={(e) => handleRuleChange(idx, 'operator', e.target.value)}>
                          {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>
                      </div>
                      <div className={styles.ruleInput}>
                        <label>Value</label>
                        <input type="text" placeholder="Value (comma separated for IN)" value={typeof rule.value === 'object' ? JSON.stringify(rule.value) : rule.value} onChange={(e) => handleRuleChange(idx, 'value', e.target.value)} required />
                      </div>
                      <div className={styles.ruleInputGroup}>
                        <label>Group ID (OR)</label>
                        <input type="number" min="1" value={rule.logic_group} onChange={(e) => handleRuleChange(idx, 'logic_group', e.target.value)} required />
                      </div>
                    </div>
                  </div>
                ))}
                
                {formData.rules.length === 0 && (
                  <div className={styles.emptyRules}>No rules defined. Anyone can qualify.</div>
                )}
              </div>
            </div>
          </form>
        </div>
        
        <div className={styles.drawerFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" form="scheme-form" className={styles.saveBtn} disabled={loading}>
            {loading ? 'Saving...' : 'Save Scheme'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchemeEditorDrawer;
