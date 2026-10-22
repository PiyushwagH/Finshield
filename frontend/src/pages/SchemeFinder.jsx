import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import ChecklistDrawer from '../components/ChecklistDrawer';
import styles from './SchemeFinder.module.css';

const SchemeFinder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [checklistScheme, setChecklistScheme] = useState(null);
  // Total schemes in the database, fetched once unfiltered - the header
  // count should reflect what's actually there, not a hardcoded guess.
  const [totalCount, setTotalCount] = useState(null);
  
  const [filters, setFilters] = useState({
    category: [],
    level: [],
  });

  const categories = [
    { id: 'agriculture', label: 'Agriculture' },
    { id: 'education', label: 'Education' },
    { id: 'health', label: 'Health' },
    { id: 'business', label: 'Business' }
  ];

  const levels = [
    { id: 'central', label: 'Central' },
    { id: 'state', label: 'State' }
  ];

  useEffect(() => {
    fetchSchemes();
    // eslint-disable-next-line
  }, [filters, search]);

  useEffect(() => {
    api.getSchemes({}).then(res => setTotalCount(res.data.length)).catch(() => {});
  }, []);

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.q = search;
      if (filters.category.length > 0) params.category = filters.category[0]; // Simplified for now
      if (filters.level.length > 0) params.level = filters.level[0]; // Simplified for now

      const res = await api.getSchemes(params);
      setSchemes(res.data);
    } catch (err) {
      console.error('Failed to fetch schemes', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterToggle = (type, id) => {
    setFilters(prev => {
      const current = prev[type];
      if (current.includes(id)) {
        return { ...prev, [type]: current.filter(item => item !== id) };
      }
      // For simple single select mapping via backend, we just replace it for now
      return { ...prev, [type]: [id] };
    });
  };

  const clearFilters = () => {
    setFilters({ category: [], level: [] });
    setSearch('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerArea}>
        <div>
          <h1 className={styles.title}>Scheme Finder</h1>
          <p className={styles.subtitle}>
            Search {totalCount !== null ? totalCount : '...'} central and state government welfare schemes
          </p>
        </div>
      </div>

      <div className={styles.searchBox}>
        <div className={styles.inputWrapper}>
          <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search by scheme name, benefit, or ask a question like 'schemes for farmers'"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={styles.searchBtn} onClick={fetchSchemes}>Search</button>
        </div>
        
        <div className={styles.quickChips}>
          <span className={styles.chipsLabel}>Popular:</span>
          {['Farmer', 'Student', 'Woman', 'Senior Citizen'].map(chip => (
            <button key={chip} className={styles.chip} onClick={() => setSearch(chip)}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.layout}>
        {/* Sidebar Filters */}
        <div className={styles.sidebar}>
          <div className={styles.filterHeader}>
            <h3>Filters</h3>
            <button className={styles.clearBtn} onClick={clearFilters}>Clear All</button>
          </div>
          
          <div className={styles.qualifyBox}>
            <input type="checkbox" id="qualify-only" className={styles.checkbox} onChange={() => navigate('/schemes/quick-check')} />
            <label htmlFor="qualify-only"><strong>Show only schemes I qualify for</strong></label>
            <p className={styles.helpText}>Takes 2 mins</p>
          </div>

          <div className={styles.filterGroup}>
            <h4>Category</h4>
            {categories.map(c => (
              <div key={c.id} className={styles.checkboxRow}>
                <input 
                  type="checkbox" 
                  id={`cat-${c.id}`} 
                  checked={filters.category.includes(c.id)}
                  onChange={() => handleFilterToggle('category', c.id)}
                />
                <label htmlFor={`cat-${c.id}`}>{c.label}</label>
              </div>
            ))}
          </div>

          <div className={styles.filterGroup}>
            <h4>Level</h4>
            {levels.map(l => (
              <div key={l.id} className={styles.checkboxRow}>
                <input 
                  type="checkbox" 
                  id={`lvl-${l.id}`} 
                  checked={filters.level.includes(l.id)}
                  onChange={() => handleFilterToggle('level', l.id)}
                />
                <label htmlFor={`lvl-${l.id}`}>{l.label}</label>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className={styles.mainContent}>
          <div className={styles.contentHeader}>
            <span>Showing <strong>{schemes.length}</strong> matching schemes</span>
            <div className={styles.sortBox}>
              Sort by:
              <select className={styles.sortSelect}>
                <option>Relevance</option>
                <option>Benefit Amount</option>
                <option>Recently Added</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading schemes...</div>
          ) : (
            <div className={styles.grid}>
              {schemes.map(scheme => (
                <div key={scheme.id} className={styles.card}>
                  <div className={styles.cardTags}>
                    <span className={styles.categoryTag}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                      {scheme.category?.toUpperCase() || 'GENERAL'}
                    </span>
                    <span className={`${styles.levelTag} ${styles[scheme.level]}`}>
                      {scheme.level === 'central' ? 'Central' : 'State'}
                    </span>
                  </div>
                  
                  <h3 className={styles.schemeName}>{scheme.name}</h3>
                  <p className={styles.ministry}>{scheme.ministry}</p>
                  
                  <p className={styles.description}>
                    {scheme.short_description || scheme.full_description?.substring(0, 80) + '...'}
                  </p>
                  
                  <div className={styles.benefitsRow}>
                    {(scheme.benefit_amount_inr || scheme.benefit_amount) && (
                      <span className={styles.benefitPill}>
                        ₹{Number(scheme.benefit_amount_inr || scheme.benefit_amount).toLocaleString('en-IN')}
                        {scheme.benefit_period === 'monthly' ? '/mo' : scheme.benefit_period === 'yearly' ? '/yr' : ''}
                      </span>
                    )}
                    {scheme.benefit_type && (
                      <span className={styles.typePill}>
                        {scheme.benefit_type.replace('_', ' ').charAt(0).toUpperCase() + scheme.benefit_type.replace('_', ' ').slice(1)}
                      </span>
                    )}
                  </div>
                  
                  <div className={styles.cardFooter}>
                    <div className={styles.statusUnknown}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      Check Eligibility
                    </div>
                    <div className={styles.cardActions}>
                      <button 
                        className={styles.checklistBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setChecklistScheme({ id: scheme.id, name: scheme.name });
                        }}
                        title="View required documents & application steps"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        Checklist
                      </button>
                      {scheme.official_url && (
                        <a
                          href={scheme.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.applyBtn}
                          onClick={e => e.stopPropagation()}
                        >
                          Apply
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10"></path></svg>
                        </a>
                      )}
                      <button 
                        className={styles.viewBtn} 
                        onClick={() => navigate(`/schemes/${scheme.slug}`)}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {!loading && schemes.length === 0 && (
            <div className={styles.emptyState}>
              <p>No schemes found matching your criteria.</p>
              <button className={styles.clearBtn} onClick={clearFilters}>Clear Filters</button>
            </div>
          )}
        </div>
      </div>

      {checklistScheme && (
        <ChecklistDrawer
          schemeId={checklistScheme.id}
          schemeName={checklistScheme.name}
          isOpen={true}
          onClose={() => setChecklistScheme(null)}
        />
      )}
    </div>
  );
};

export default SchemeFinder;
