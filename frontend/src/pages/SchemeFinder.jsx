import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import ChecklistDrawer from '../components/ChecklistDrawer';
import styles from './SchemeFinder.module.css';
import { useLanguage } from '../context/LanguageContext';
import { CardGridSkeleton } from '../components/Skeleton';

const SchemeFinder = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
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
    { id: 'agriculture', label: t('scat.agriculture') },
    { id: 'education', label: t('scat.education') },
    { id: 'health', label: t('scat.health') },
    { id: 'business', label: t('scat.business') }
  ];

  const levels = [
    { id: 'central', label: t('level.central') },
    { id: 'state', label: t('level.state') }
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
          <h1 className={styles.title}>{t('finder.title')}</h1>
          <p className={styles.subtitle}>
            {t('finder.subtitle', { n: totalCount !== null ? totalCount : '…' })}
          </p>
        </div>
      </div>

      <div className={styles.searchBox}>
        <div className={styles.inputWrapper}>
          <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder={t('finder.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={styles.searchBtn} onClick={fetchSchemes}>{t('finder.search')}</button>
        </div>
        
        <div className={styles.quickChips}>
          <span className={styles.chipsLabel}>{t('finder.popular')}</span>
          {/* Search terms stay English: scheme text in the database is English. */}
          {[['Farmer', 'finder.chipFarmer'], ['Student', 'finder.chipStudent'], ['Woman', 'finder.chipWoman'], ['Senior Citizen', 'finder.chipSenior']].map(([term, key]) => (
            <button key={term} className={styles.chip} onClick={() => setSearch(term)}>
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.layout}>
        {/* Sidebar Filters */}
        <div className={styles.sidebar}>
          <div className={styles.filterHeader}>
            <h3>{t('finder.filters')}</h3>
            <button className={styles.clearBtn} onClick={clearFilters}>{t('finder.clearAll')}</button>
          </div>
          
          <div className={styles.qualifyBox}>
            <input type="checkbox" id="qualify-only" className={styles.checkbox} onChange={() => navigate('/schemes/quick-check')} />
            <label htmlFor="qualify-only"><strong>{t('finder.qualifyOnly')}</strong></label>
            <p className={styles.helpText}>{t('finder.takes2')}</p>
          </div>

          <div className={styles.filterGroup}>
            <h4>{t('finder.category')}</h4>
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
            <h4>{t('finder.level')}</h4>
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
            <span>{t('finder.showing', { n: schemes.length })}</span>
            <div className={styles.sortBox}>
              {t('finder.sortBy')}
              <select className={styles.sortSelect}>
                <option>{t('finder.sortRelevance')}</option>
                <option>{t('finder.sortBenefit')}</option>
                <option>{t('finder.sortRecent')}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <CardGridSkeleton count={6} />
          ) : (
            <div className={styles.grid}>
              {schemes.map(scheme => (
                <div key={scheme.id} className={styles.card}>
                  <div className={styles.cardTags}>
                    <span className={styles.categoryTag}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                      {t(`scat.${scheme.category || 'general'}`)}
                    </span>
                    <span className={`${styles.levelTag} ${styles[scheme.level]}`}>
                      {scheme.level === 'central' ? t('level.central') : t('level.state')}
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
                        {scheme.benefit_period === 'monthly' ? t('finder.perMo') : scheme.benefit_period === 'yearly' ? t('finder.perYr') : ''}
                      </span>
                    )}
                    {scheme.benefit_type && (
                      <span className={styles.typePill}>
                        {t(`btype.${scheme.benefit_type}`)}
                      </span>
                    )}
                  </div>
                  
                  <div className={styles.cardFooter}>
                    <div className={styles.statusUnknown}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      {t('finder.checkElig')}
                    </div>
                    <div className={styles.cardActions}>
                      <button 
                        className={styles.checklistBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setChecklistScheme({ id: scheme.id, name: scheme.name });
                        }}
                        title={t('finder.checklistTitle')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        {t('finder.checklist')}
                      </button>
                      {scheme.official_url && (
                        <a
                          href={scheme.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.applyBtn}
                          onClick={e => e.stopPropagation()}
                        >
                          {t('finder.apply')}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10"></path></svg>
                        </a>
                      )}
                      <button 
                        className={styles.viewBtn} 
                        onClick={() => navigate(`/schemes/${scheme.slug}`)}
                      >
                        {t('finder.details')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {!loading && schemes.length === 0 && (
            <div className={styles.emptyState}>
              <p>{t('finder.none')}</p>
              <button className={styles.clearBtn} onClick={clearFilters}>{t('finder.clearFilters')}</button>
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
