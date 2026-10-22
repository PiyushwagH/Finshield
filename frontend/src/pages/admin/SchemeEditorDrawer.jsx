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

const benefitTypes = [
  { value: 'cash', label: 'Cash (Direct DBT / Transfer)' },
  { value: 'loan_subsidy', label: 'Loan Subsidy / Subvention' },
  { value: 'insurance', label: 'Insurance (Health / Life / Crop)' },
  { value: 'savings_return', label: 'Savings Return (PPF / APY / Sukanya)' },
  { value: 'unquantified', label: 'Unquantified (Skill / Non-cash)' }
];

const benefitPeriods = [
  { value: 'yearly', label: 'Yearly (Annual)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'one_time', label: 'One Time (Grant / Settlement)' }
];

const SchemeEditorDrawer = ({ scheme, onClose }) => {
  const isEditing = !!scheme;
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    short_description: '',
    full_description: '',
    ministry: '',
    category: 'education',
    level: 'central',
    status: 'draft',
    benefit_type: 'cash',
    benefit_amount_inr: '',
    benefit_period: 'yearly',
    driver_tags: '',
    documents: '',
    apply_steps: '',
    last_verified_at: '',
    official_url: '',
    application_mode: '',
    source_url: '',
    rules: []
  });

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (isEditing && scheme) {
      const docs = Array.isArray(scheme.documents) && scheme.documents.length > 0
        ? scheme.documents.join('\n')
        : (Array.isArray(scheme.required_documents) ? scheme.required_documents.join('\n') : '');
      const steps = Array.isArray(scheme.apply_steps) ? scheme.apply_steps.join('\n') : '';
      const tags = Array.isArray(scheme.driver_tags) ? scheme.driver_tags.join(', ') : '';
      const verifiedDate = scheme.last_verified_at ? String(scheme.last_verified_at).substring(0, 10) : '';

      setFormData({
        name: scheme.name || '',
        slug: scheme.slug || '',
        short_description: scheme.short_description || '',
        full_description: scheme.full_description || '',
        ministry: scheme.ministry || '',
        category: scheme.category || 'education',
        level: scheme.level || 'central',
        status: scheme.status || 'draft',
        benefit_type: scheme.benefit_type || 'cash',
        benefit_amount_inr: scheme.benefit_amount_inr ?? scheme.benefit_amount ?? '',
        benefit_period: scheme.benefit_period || 'yearly',
        driver_tags: tags,
        documents: docs,
        apply_steps: steps,
        last_verified_at: verifiedDate,
        official_url: scheme.official_url || '',
        application_mode: scheme.application_mode || '',
        source_url: scheme.source_url || '',
        rules: scheme.rules || []
      });
    }
  }, [scheme, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSubmitError(null);
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
    newRules[index][field] = value;
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const handleRemoveRule = (index) => {
    const newRules = [...formData.rules];
    newRules.splice(index, 1);
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  // Inline validation for active schemes
  const docsList = formData.documents
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  const stepsList = formData.apply_steps
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  const tagsList = formData.driver_tags
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const isActive = formData.status === 'active';
  const errors = {};
  if (isActive) {
    if (!formData.official_url || !formData.official_url.trim()) {
      errors.official_url = 'Active schemes require an official application URL';
    }
    if (docsList.length === 0) {
      errors.documents = 'Active schemes require at least one verified document';
    }
    if (stepsList.length === 0) {
      errors.apply_steps = 'Active schemes require at least one step-by-step application instruction';
    }
    if (!formData.last_verified_at) {
      errors.last_verified_at = 'Active schemes require a verification date';
    }
  }

  const hasValidationErrors = Object.keys(errors).length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasValidationErrors) {
      setSubmitError('Please address all validation requirements before saving an active scheme.');
      return;
    }
    setLoading(true);
    setSubmitError(null);
    
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

    const amountNum = formData.benefit_amount_inr !== '' && !isNaN(Number(formData.benefit_amount_inr))
      ? Number(formData.benefit_amount_inr)
      : null;
    
    const payload = {
      name: formData.name,
      slug: formData.slug,
      short_description: formData.short_description || null,
      full_description: formData.full_description || null,
      ministry: formData.ministry || null,
      category: formData.category || null,
      level: formData.level || null,
      status: formData.status,
      benefit_type: formData.benefit_type || null,
      benefit_amount: amountNum,
      benefit_amount_inr: amountNum,
      benefit_period: formData.benefit_period || null,
      driver_tags: tagsList,
      documents: docsList,
      required_documents: docsList,
      apply_steps: stepsList,
      last_verified_at: formData.last_verified_at ? new Date(formData.last_verified_at).toISOString() : null,
      official_url: formData.official_url || null,
      application_mode: formData.application_mode || null,
      source_url: formData.source_url || null,
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
      const msg = err.response?.data?.detail || 'Failed to save scheme. Please verify the input values.';
      setSubmitError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <h2>{isEditing ? 'Edit Scheme' : 'Add New Scheme'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close editor">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className={styles.drawerBody}>
          {submitError && (
            <div className={styles.alertBox} role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{submitError}</span>
            </div>
          )}

          {isActive && hasValidationErrors && (
            <div className={styles.warningBox}>
              <strong>Active Scheme Verification Required:</strong>
              <p>Active schemes are publicly recommended and must have verified official links, required documents, application steps, and a verification date. Please fill in these fields or change status to <em>Draft</em> or <em>Needs Review</em>.</p>
            </div>
          )}

          <form id="scheme-form" onSubmit={handleSubmit}>
            {/* 1. Basic Info */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Basic Information</h3>
              
              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_name">Scheme Name *</label>
                  <input id="scheme_name" type="text" name="name" required value={formData.name} onChange={handleChange} />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_slug">Slug *</label>
                  <input id="scheme_slug" type="text" name="slug" required value={formData.slug} onChange={handleChange} disabled={isEditing} />
                </div>
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="scheme_short_desc">Short Description</label>
                <textarea id="scheme_short_desc" name="short_description" rows="2" value={formData.short_description} onChange={handleChange}></textarea>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="scheme_full_desc">Full Description</label>
                <textarea id="scheme_full_desc" name="full_description" rows="3" value={formData.full_description} onChange={handleChange} placeholder="Shown on the scheme Overview tab"></textarea>
              </div>

              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_ministry">Ministry / Department</label>
                  <input id="scheme_ministry" type="text" name="ministry" value={formData.ministry} onChange={handleChange} />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_category">Category</label>
                  <select id="scheme_category" name="category" value={formData.category} onChange={handleChange}>
                    <option value="agriculture">Agriculture</option>
                    <option value="education">Education</option>
                    <option value="health">Health</option>
                    <option value="business">Business</option>
                    <option value="welfare">Welfare</option>
                    <option value="housing">Housing</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_level">Level</label>
                  <select id="scheme_level" name="level" value={formData.level} onChange={handleChange}>
                    <option value="central">Central</option>
                    <option value="state">State</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_status">Publication Status *</label>
                  <select id="scheme_status" name="status" value={formData.status} onChange={handleChange}>
                    <option value="draft">Draft</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="active">Active (Published &amp; Matched)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Benefits & Driver Matching */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Benefits &amp; Risk Driver Alignment</h3>
              <p className={styles.helpText}>Configure verified benefit quantification and tag financial risk drivers that this scheme mitigates.</p>

              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_btype">Benefit Type</label>
                  <select id="scheme_btype" name="benefit_type" value={formData.benefit_type} onChange={handleChange}>
                    {benefitTypes.map(b => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_bperiod">Benefit Period</label>
                  <select id="scheme_bperiod" name="benefit_period" value={formData.benefit_period} onChange={handleChange}>
                    {benefitPeriods.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_bamount">Benefit Amount (₹ plain number)</label>
                  <input
                    id="scheme_bamount"
                    type="number"
                    name="benefit_amount_inr"
                    value={formData.benefit_amount_inr}
                    onChange={handleChange}
                    placeholder="e.g. 6000 (annual DBT) or 500000 (insurance cover)"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_tags">Driver Tags (comma-separated)</label>
                  <input
                    id="scheme_tags"
                    type="text"
                    name="driver_tags"
                    value={formData.driver_tags}
                    onChange={handleChange}
                    placeholder="e.g. savings, emi_burden, irregular_income"
                  />
                </div>
              </div>
            </div>

            {/* 3. Verification & Application Checklist */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Verification &amp; Application Checklist</h3>
              <p className={styles.helpText}>Active schemes require official portal links, verified document requirements, and step-by-step guidance.</p>

              <div className={styles.inputGroup}>
                <label htmlFor="scheme_official_url">Official Application URL {isActive && '*'}</label>
                <input
                  id="scheme_official_url"
                  type="url"
                  name="official_url"
                  value={formData.official_url}
                  onChange={handleChange}
                  placeholder="https://..."
                  className={errors.official_url ? styles.inputError : ''}
                />
                {errors.official_url && <span className={styles.errorMsg}>{errors.official_url}</span>}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="scheme_docs">Required Documents (one per line) {isActive && '*'}</label>
                <textarea
                  id="scheme_docs"
                  name="documents"
                  rows="3"
                  value={formData.documents}
                  onChange={handleChange}
                  placeholder="Aadhaar Card&#10;Land ownership records&#10;Active Bank Account Passbook"
                  className={errors.documents ? styles.inputError : ''}
                ></textarea>
                {errors.documents && <span className={styles.errorMsg}>{errors.documents}</span>}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="scheme_steps">Step-by-Step Application Instructions (one per line) {isActive && '*'}</label>
                <textarea
                  id="scheme_steps"
                  name="apply_steps"
                  rows="3"
                  value={formData.apply_steps}
                  onChange={handleChange}
                  placeholder="1. Visit the official portal link&#10;2. Register using mobile OTP&#10;3. Submit application"
                  className={errors.apply_steps ? styles.inputError : ''}
                ></textarea>
                {errors.apply_steps && <span className={styles.errorMsg}>{errors.apply_steps}</span>}
              </div>

              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_verified_date">Last Verified Date {isActive && '*'}</label>
                  <input
                    id="scheme_verified_date"
                    type="date"
                    name="last_verified_at"
                    value={formData.last_verified_at}
                    onChange={handleChange}
                    className={errors.last_verified_at ? styles.inputError : ''}
                  />
                  {errors.last_verified_at && <span className={styles.errorMsg}>{errors.last_verified_at}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="scheme_app_mode">Application Mode</label>
                  <input
                    id="scheme_app_mode"
                    type="text"
                    name="application_mode"
                    value={formData.application_mode}
                    onChange={handleChange}
                    placeholder="e.g. Online via portal or offline at CSC"
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="scheme_source_url">Source URL (Government Gazette / Press Release)</label>
                <input
                  id="scheme_source_url"
                  type="url"
                  name="source_url"
                  value={formData.source_url}
                  onChange={handleChange}
                  placeholder="https://pib.gov.in/..."
                />
              </div>
            </div>

            {/* 4. Eligibility Rules */}
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
                      <button type="button" className={styles.removeRuleBtn} onClick={() => handleRemoveRule(idx)} aria-label={`Remove rule ${idx + 1}`}>
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
                  <div className={styles.emptyRules}>No automated rules configured. All applicants qualify.</div>
                )}
              </div>
            </div>
          </form>
        </div>
        
        <div className={styles.drawerFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button
            type="submit"
            form="scheme-form"
            className={styles.saveBtn}
            disabled={loading || (isActive && hasValidationErrors)}
            title={isActive && hasValidationErrors ? 'Complete active scheme requirements to save' : 'Save Scheme'}
          >
            {loading ? 'Saving...' : 'Save Scheme'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchemeEditorDrawer;
