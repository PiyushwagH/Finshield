import React, { useEffect, useState, useRef, useId } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

import apiClient from '../api/client';
import assessmentPlanApi from '../api/assessmentPlan';
import { mapRiskBand } from '../utils/riskBand';
import { useLanguage } from '../context/LanguageContext';
import ChecklistDrawer from '../components/ChecklistDrawer';
import styles from './RiskResult.module.css';
import { ResultSkeleton, SkeletonCard } from '../components/Skeleton';

// English ordinal suffix (1st, 2nd, 3rd, 4th...)
const ordinalSuffix = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

const formatINR = (val) => {
  if (val === null || val === undefined) return '0';
  return Number(val).toLocaleString('en-IN');
};

const SemicircularGauge = ({ score }) => {
  const { t } = useLanguage();
  const minScore = 300;
  const maxScore = 850;
  const clampedScore = Math.max(minScore, Math.min(maxScore, score || 300));
  const percentage = (clampedScore - minScore) / (maxScore - minScore);
  const angle = -90 + percentage * 180;
  
  return (
    <div className={styles.gaugeContainer}>
      <svg viewBox="0 0 200 110" className={styles.gaugeSvg}>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--risk-high)" />
            <stop offset="50%" stopColor="var(--risk-medium)" />
            <stop offset="100%" stopColor="var(--risk-low)" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${angle}, 100, 100)`}>
          <line x1="100" y1="100" x2="100" y2="30" stroke="var(--navy)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="100" cy="100" r="7" fill="var(--navy)" />
        </g>
      </svg>
      <div className={styles.gaugeValueText}>
        <span className={styles.scoreNumber}>{clampedScore}</span>
        <span className={styles.scoreMax}>{t('result.outOf')}</span>
      </div>
    </div>
  );
};

const RiskResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang, t, tx } = useLanguage();

  // Primary assessment state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tabs state: 'plan' | 'whatif' | 'schemes'
  const [activeTab, setActiveTab] = useState('plan');

  // Plan data
  const [planData, setPlanData] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Schemes data
  const [schemesData, setSchemesData] = useState(null);
  const [schemesLoading, setSchemesLoading] = useState(false);

  // What-If state
  const [whatifInputs, setWhatifInputs] = useState({
    monthly_emi: 0,
    savings: 0,
    monthly_expenditure: 0,
    annual_income: 0,
  });
  const [selectedSchemeIds, setSelectedSchemeIds] = useState([]);
  const [whatifResult, setWhatifResult] = useState(null);
  const [whatifLoading, setWhatifLoading] = useState(false);

  // Checklist drawer state
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [activeSchemeForChecklist, setActiveSchemeForChecklist] = useState(null);

  // PDF download state
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // 1. Fetch baseline assessment
  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/risk/assessments/${id}`);
        setData(res.data);

        // Initialise whatif sliders from assessment input_data
        const inp = res.data.input_data || {};
        setWhatifInputs({
          monthly_emi: Number(inp.monthly_emi || 0),
          savings: Number(inp.savings || 0),
          monthly_expenditure: Number(inp.monthly_expenditure || 0),
          annual_income: Number(inp.annual_income || 0),
        });
      } catch (err) {
        setError(err.response?.data?.detail || t('result.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchResult();
  }, [id]);

  // 2. Fetch Plan & Schemes on lang or id change
  useEffect(() => {
    if (!id) return;

    // Fetch Plan
    setPlanLoading(true);
    assessmentPlanApi.getAssessmentPlan(id, lang)
      .then((res) => setPlanData(res.data))
      .catch((err) => console.error('Plan error:', err))
      .finally(() => setPlanLoading(false));

    // Fetch Schemes
    setSchemesLoading(true);
    assessmentPlanApi.getAssessmentSchemes(id, lang)
      .then((res) => setSchemesData(res.data))
      .catch((err) => console.error('Schemes error:', err))
      .finally(() => setSchemesLoading(false));
  }, [id, lang]);

  // 3. Debounced What-If evaluation
  useEffect(() => {
    if (!id || !data) return;

    const timer = setTimeout(() => {
      setWhatifLoading(true);
      assessmentPlanApi.simulateWhatIf({
        assessment_id: id,
        changes: whatifInputs,
        scheme_ids: selectedSchemeIds,
      }, lang)
        .then((res) => setWhatifResult(res.data))
        .catch((err) => console.error('What-If error:', err))
        .finally(() => setWhatifLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [id, data, whatifInputs, selectedSchemeIds, lang]);

  // Handle PDF report download
  const handleDownloadPdf = async () => {
    try {
      setPdfDownloading(true);
      setPdfError(null);
      const res = await assessmentPlanApi.downloadReportPdf(id, lang);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FinShield_Report_${id.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(t('result.pdfFailed'));
    } finally {
      setPdfDownloading(false);
    }
  };

  // Toggle "already using" scheme with optimistic update & rollback
  const handleToggleUsing = async (schemeId, currentStatus) => {
    const newStatus = currentStatus === 'using' ? 'not_using' : 'using';

    // Optimistic update
    setSchemesData((prev) => {
      if (!prev) return prev;
      const updated = prev.matched.map((s) => {
        if (s.scheme_id === schemeId) {
          return { ...s, my_status: newStatus };
        }
        return s;
      });

      // Recalculate missed count
      const newMissed = updated.filter(
        (s) => (s.eligibility === 'eligible' || s.eligibility === 'likely') && s.my_status !== 'using'
      );
      const totalAnn = newMissed.reduce((acc, cur) => acc + (cur.benefit.annual_inr || 0), 0);
      const unquant = newMissed.filter((s) => s.benefit.annual_inr === null).length;

      return {
        ...prev,
        matched: updated,
        missed_summary: {
          count: newMissed.length,
          total_annual_inr: totalAnn,
          unquantified_count: unquant,
        },
      };
    });

    try {
      await assessmentPlanApi.updateSchemeStatus(schemeId, newStatus);
    } catch (err) {
      // Rollback on failure
      setSchemesData((prev) => {
        if (!prev) return prev;
        const rolled = prev.matched.map((s) => {
          if (s.scheme_id === schemeId) {
            return { ...s, my_status: currentStatus };
          }
          return s;
        });
        return { ...prev, matched: rolled };
      });
    }
  };

  if (loading) return <div className={styles.container}><ResultSkeleton /></div>;
  if (error || !data) return <div className={styles.container}><div className={styles.card}>{error || t('result.notFound')}</div></div>;

  // Slider ranges are fixed from the original assessment values. They used to
  // be derived from each slider's own live value (value * 2), so the max grew
  // as you dragged and the thumb could never get past the middle.
  const baseInput = data.input_data || {};
  const rangeMax = (base, floor, step) => Math.ceil(Math.max(floor, Number(base || 0) * 3) / step) * step;
  const sliderMax = {
    monthly_emi: rangeMax(baseInput.monthly_emi, 100000, 1000),
    savings: rangeMax(baseInput.savings, 500000, 5000),
    monthly_expenditure: rangeMax(baseInput.monthly_expenditure, 100000, 1000),
    annual_income: rangeMax(baseInput.annual_income, 2000000, 10000),
  };

  const mappedBand = mapRiskBand(data.risk_band);
  const defProbPct = (data.default_probability * 100).toFixed(1);
  const popRate = data.model_meta?.population_default_rate 
    ? (data.model_meta.population_default_rate * 100).toFixed(1) 
    : '8.1';

  // Chart data for What-If comparison
  const chartData = [
    {
      name: t('result.chartScore'),
      Baseline: whatifResult?.base?.score ?? data.risk_score,
      Scenario: whatifResult?.scenario?.score ?? data.risk_score,
    },
    {
      name: t('result.chartSurplus'),
      Baseline: Math.round(whatifResult?.affordability_base?.monthly_surplus ?? data.affordability?.monthly_surplus ?? 0),
      Scenario: Math.round(whatifResult?.affordability_scenario?.monthly_surplus ?? data.affordability?.monthly_surplus ?? 0),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.printableArea}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('result.title')}</h1>
            <p className={styles.subtitle}>{t('result.subtitle')}</p>
          </div>
        </div>

        {/* Top Hero Card with Gauge */}
        <div className={styles.card}>
          <SemicircularGauge score={data.risk_score} />
          
          <div className={styles.bandBadgeContainer}>
            <span className={`${styles.bandBadge} ${styles['band' + mappedBand]}`}>
              {t(`band.${mappedBand}`)}
            </span>
          </div>

          <p className={styles.sentence}>
            {t('result.probPre')}<strong>{defProbPct}%</strong>{t('result.probMid')}<strong>{popRate}%</strong>{t('result.probPost')}
          </p>

          <p className={styles.percentileLine}>
            {t('result.pctPre')}<strong>{t('result.pctVal', { n: Math.round(data.population_percentile), sfx: ordinalSuffix(Math.round(data.population_percentile)) })}</strong>{t('result.pctPost')}
          </p>
        </div>

        {/* Existing Two-Column Grid: Drivers & Affordability Check */}
        <div className={styles.twoColumnGrid}>
          {/* Driver Factors */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('result.drivers')}</h2>

            {data.factors?.positive?.length > 0 && (
              <div className={styles.factorGroup}>
                <h3 className={styles.positiveHeader}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                  {t('result.favour')}
                </h3>
                <ul className={styles.factorList}>
                  {data.factors.positive.map((factor, idx) => (
                    <li key={idx} className={styles.factorItemPositive}>
                      <span>{tx(factor)}</span>
                      <span className={styles.tagPos}>{t('result.tagPos')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.factors?.negative?.length > 0 && (
              <div className={styles.factorGroup}>
                <h3 className={styles.negativeHeader}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                  {t('result.raising')}
                </h3>
                <ul className={styles.factorList}>
                  {data.factors.negative.map((factor, idx) => (
                    <li key={idx} className={styles.factorItemNegative}>
                      <span>{tx(factor)}</span>
                      <span className={styles.tagNeg}>{t('result.tagNeg')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Affordability Check */}
          <div className={styles.card}>
            <div className={styles.cardHeaderFlex}>
              <h2 className={styles.cardTitle}>{t('result.affordability')}</h2>
              <span className={styles.gradeBadge}>{data.affordability?.grade ? tx(data.affordability.grade) : t('result.standard')}</span>
            </div>

            <div className={styles.affordabilityRows}>
              <div className={styles.affRow}>
                <span>{t('result.surplus')}</span>
                <strong>₹{formatINR(data.affordability?.monthly_surplus)}</strong>
              </div>
              <div className={styles.affRow}>
                <span>{t('result.surplusRatio')}</span>
                <strong>{((data.affordability?.surplus_ratio || 0) * 100).toFixed(1)}%</strong>
              </div>
              <div className={styles.affRow}>
                <span>{t('result.emiRatio')}</span>
                <strong>{((data.affordability?.emi_to_income_ratio || 0) * 100).toFixed(1)}%</strong>
              </div>
              <div className={styles.affRow}>
                <span>{t('result.fundMonths')}</span>
                <strong>{t('result.months', { n: data.affordability?.emergency_fund_months ?? '—' })}</strong>
              </div>
            </div>

            {data.affordability?.flags?.length > 0 && (
              <div className={styles.flagsBox}>
                <h4 className={styles.flagsTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                  {t('result.flags')}
                </h4>
                <ul>
                  {data.affordability.flags.map((flag, idx) => (
                    <li key={idx}>{tx(flag)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Accessible TABS Navigation */}
        <div className={styles.tabsContainer} role="tablist" aria-label={t('result.tablist')}>
          <button
            role="tab"
            aria-selected={activeTab === 'plan'}
            className={`${styles.tabBtn} ${activeTab === 'plan' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            <span>{t('tabs.plan')}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'whatif'}
            className={`${styles.tabBtn} ${activeTab === 'whatif' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('whatif')}
          >
            <span>{t('tabs.whatif')}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'schemes'}
            className={`${styles.tabBtn} ${activeTab === 'schemes' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('schemes')}
          >
            <span>{t('tabs.schemes')}</span>
            {schemesData?.missed_summary?.count > 0 && (
              <span className={styles.tabBadge}>{schemesData.missed_summary.count}</span>
            )}
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: YOUR PLAN                                                  */}
        {/* ================================================================= */}
        {activeTab === 'plan' && (
          <div className={styles.planSection} role="tabpanel" aria-labelledby="tab-plan">
            {planLoading ? (
              <><SkeletonCard lines={6} /><SkeletonCard lines={4} /></>
            ) : planData ? (
              <>
                {/* 1. Driver Bars (Top 6) */}
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>{t('plan.driversTitle')}</h2>
                  <p className={styles.subtitle} style={{ marginBottom: '1rem' }}>{t('plan.driversSubtitle')}</p>
                  
                  <div className={styles.driversGrid}>
                    {planData.drivers?.map((driver, idx) => {
                      const isIncreases = driver.direction === 'increases_risk';
                      return (
                        <div key={idx} className={styles.driverRow}>
                          <div className={styles.driverMeta}>
                            <span className={styles.driverName}>{driver.label}</span>
                            <span className={styles.driverImpactTag}>
                              <span className={isIncreases ? styles.dirIncreases : styles.dirReduces}>
                                {isIncreases ? t('plan.raisesRisk') : t('plan.lowersRisk')}
                              </span>
                              <span>{driver.impact_pct}%</span>
                            </span>
                          </div>
                          <div className={styles.driverTrack}>
                            <div
                              className={`${styles.driverFill} ${isIncreases ? styles.driverFillIncreases : styles.driverFillReduces}`}
                              style={{ width: `${Math.min(100, Math.max(10, driver.impact_pct * 2.5))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Ranked Priorities */}
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>{t('plan.prioritiesTitle')}</h2>
                  <div className={styles.priorityList}>
                    {planData.priorities?.map((p, idx) => (
                      <div key={idx} className={styles.priorityCard}>
                        <div className={styles.rankCircle}>#{p.rank}</div>
                        <div className={styles.priorityContent}>
                          <div className={styles.priorityTop}>
                            <h3 className={styles.priorityTitle}>{p.title}</h3>
                            <div className={styles.priorityBadges}>
                              <span className={styles.gainBadge}>
                                {p.est_score_gain > 0 ? t('plan.ptsGain', { pts: p.est_score_gain }) : t('result.stabilization')}
                              </span>
                              <span className={styles.timeframeChip}>{t(`result.tf${p.timeframe}`)}</span>
                            </div>
                          </div>
                          <p className={styles.priorityWhy}>{p.why}</p>
                          <p className={styles.priorityAction}><strong>{t('result.action')}</strong> {p.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. 3/6/12 Month Roadmap */}
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>{t('plan.roadmapTitle')}</h2>
                  <div className={styles.roadmapGrid}>
                    {['3m', '6m', '12m'].map((period) => (
                      <div key={period} className={styles.roadmapCol}>
                        <span className={styles.roadmapHorizonTitle}>
                          {t(`result.tf${period}`)}
                        </span>
                        {planData.roadmap?.[period]?.map((item, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <h4 className={styles.roadmapItemTitle}>{item.title}</h4>
                            <p className={styles.roadmapItemDetail}>{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Prevention Habits */}
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>{t('plan.habitsTitle')}</h2>
                  <div className={styles.habitsGrid}>
                    {planData.habits?.map((habit, idx) => (
                      <div key={idx} className={styles.habitCard}>
                        <svg className={styles.habitCheckIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <div>
                          <h4 className={styles.habitTitle}>{habit.title}</h4>
                          <p className={styles.habitDetail}>{habit.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: WHAT-IF SIMULATOR                                          */}
        {/* ================================================================= */}
        {activeTab === 'whatif' && (
          <div className={styles.card} role="tabpanel" aria-labelledby="tab-whatif">
            <h2 className={styles.cardTitle}>{t('whatif.title')}</h2>
            <p className={styles.subtitle} style={{ marginBottom: '1.5rem' }}>{t('whatif.subtitle')}</p>

            <div className={styles.whatifLayout}>
              {/* Left Column: Sliders & Controls */}
              <div className={styles.controlsColumn}>
                {/* 1. Monthly EMI */}
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderLabelRow}>
                    <label className={styles.sliderLabel}>{t('whatif.monthlyEmi')}</label>
                    <div className={styles.sliderInputWrapper}>
                      <span className={styles.currencySym}>₹</span>
                      <input
                        type="number"
                        className={styles.sliderInput}
                        value={whatifInputs.monthly_emi}
                        min={0}
                        max={300000}
                        step={1000}
                        onChange={(e) => setWhatifInputs((prev) => ({ ...prev, monthly_emi: Math.max(0, Number(e.target.value)) }))}
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    className={styles.rangeSlider}
                    min={0}
                    max={Math.max(sliderMax.monthly_emi, whatifInputs.monthly_emi)}
                    step={1000}
                    value={whatifInputs.monthly_emi}
                    onChange={(e) => setWhatifInputs((prev) => ({ ...prev, monthly_emi: Number(e.target.value) }))}
                    aria-label={t('whatif.monthlyEmi')}
                  />
                </div>

                {/* 2. Liquid Savings */}
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderLabelRow}>
                    <label className={styles.sliderLabel}>{t('whatif.savings')}</label>
                    <div className={styles.sliderInputWrapper}>
                      <span className={styles.currencySym}>₹</span>
                      <input
                        type="number"
                        className={styles.sliderInput}
                        value={whatifInputs.savings}
                        min={0}
                        max={10000000}
                        step={5000}
                        onChange={(e) => setWhatifInputs((prev) => ({ ...prev, savings: Math.max(0, Number(e.target.value)) }))}
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    className={styles.rangeSlider}
                    min={0}
                    max={Math.max(sliderMax.savings, whatifInputs.savings)}
                    step={5000}
                    value={whatifInputs.savings}
                    onChange={(e) => setWhatifInputs((prev) => ({ ...prev, savings: Number(e.target.value) }))}
                    aria-label={t('whatif.savings')}
                  />
                </div>

                {/* 3. Monthly Expenditure */}
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderLabelRow}>
                    <label className={styles.sliderLabel}>{t('whatif.expenditure')}</label>
                    <div className={styles.sliderInputWrapper}>
                      <span className={styles.currencySym}>₹</span>
                      <input
                        type="number"
                        className={styles.sliderInput}
                        value={whatifInputs.monthly_expenditure}
                        min={1000}
                        max={300000}
                        step={1000}
                        onChange={(e) => setWhatifInputs((prev) => ({ ...prev, monthly_expenditure: Math.max(0, Number(e.target.value)) }))}
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    className={styles.rangeSlider}
                    min={0}
                    max={Math.max(sliderMax.monthly_expenditure, whatifInputs.monthly_expenditure)}
                    step={1000}
                    value={whatifInputs.monthly_expenditure}
                    onChange={(e) => setWhatifInputs((prev) => ({ ...prev, monthly_expenditure: Number(e.target.value) }))}
                    aria-label={t('whatif.expenditure')}
                  />
                </div>

                {/* 4. Annual Income */}
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderLabelRow}>
                    <label className={styles.sliderLabel}>{t('whatif.income')}</label>
                    <div className={styles.sliderInputWrapper}>
                      <span className={styles.currencySym}>₹</span>
                      <input
                        type="number"
                        className={styles.sliderInput}
                        value={whatifInputs.annual_income}
                        min={50000}
                        max={20000000}
                        step={10000}
                        onChange={(e) => setWhatifInputs((prev) => ({ ...prev, annual_income: Math.max(10000, Number(e.target.value)) }))}
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    className={styles.rangeSlider}
                    min={50000}
                    max={Math.max(sliderMax.annual_income, whatifInputs.annual_income)}
                    step={10000}
                    value={whatifInputs.annual_income}
                    onChange={(e) => setWhatifInputs((prev) => ({ ...prev, annual_income: Number(e.target.value) }))}
                    aria-label={t('whatif.income')}
                  />
                </div>

                {/* Scheme Toggles Box */}
                {schemesData?.matched?.length > 0 && (
                  <div className={styles.schemeTogglesCard}>
                    <h4 className={styles.schemeToggleHeader}>{t('whatif.schemeTogglePrompt')}</h4>
                    {schemesData.matched.slice(0, 5).map((s) => {
                      const isSelected = selectedSchemeIds.includes(s.scheme_id);
                      const benefitStr = s.benefit.monthly_inr 
                        ? `+₹${formatINR(s.benefit.monthly_inr)}${t('result.perMo')}` 
                        : (s.benefit.annual_inr ? `+₹${formatINR(Math.round(s.benefit.annual_inr / 12))}${t('result.perMo')}` : '');

                      return (
                        <div key={s.scheme_id} className={styles.schemeToggleItem}>
                          <label className={styles.schemeToggleLabel}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedSchemeIds((prev) => 
                                  prev.includes(s.scheme_id)
                                    ? prev.filter((id) => id !== s.scheme_id)
                                    : [...prev, s.scheme_id]
                                );
                              }}
                            />
                            <span>{s.name}</span>
                          </label>
                          {benefitStr && <span className={styles.schemeToggleAmt}>{benefitStr}</span>}
                        </div>
                      );
                    })}

                    {whatifResult?.scheme_benefit_monthly_inr > 0 && (
                      <div className={styles.schemeNoticeBox}>
                        {t('whatif.schemeSurplusNotice', { amt: `₹${formatINR(whatifResult.scheme_benefit_monthly_inr)}${t('result.perMo')}` })}
                      </div>
                    )}
                    <p className={styles.schemeNoteBox}>{t('whatif.schemeNote')}</p>
                  </div>
                )}
              </div>

              {/* Right Column: Comparison Card & Charts */}
              <div className={styles.comparisonColumn}>
                <div className={styles.deltaHeroCard}>
                  <div className={styles.deltaItem}>
                    <span className={styles.deltaLabel}>{t('result.baseScore')}</span>
                    <span className={styles.deltaVal}>{whatifResult?.base?.score ?? data.risk_score}</span>
                    <span className={styles.deltaLabel}>{t('result.bandRisk', { band: t(`band.word.${mapRiskBand(whatifResult?.base?.band ?? data.risk_band)}`) })}</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.4)' }}>➔</div>
                  <div className={styles.deltaItem}>
                    <span className={styles.deltaLabel}>{t('result.scenarioScore')}</span>
                    <span className={styles.deltaVal}>{whatifResult?.scenario?.score ?? data.risk_score}</span>
                    <span className={whatifResult?.score_delta >= 0 ? styles.deltaDiffGain : styles.deltaDiffLoss}>
                      {whatifResult?.score_delta >= 0 ? `+${whatifResult?.score_delta || 0}` : whatifResult?.score_delta} {t('result.pts')} ({t(`band.word.${mapRiskBand(whatifResult?.scenario?.band ?? data.risk_band)}`)})
                    </span>
                  </div>
                </div>

                {/* Recharts comparison */}
                <div className={styles.chartCard}>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.5rem' }}>
                    {t('result.comparison')}
                  </h4>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--navy)' }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}
                          formatter={(value, name) => [typeof value === 'number' ? value.toLocaleString('en-IN') : value, name]}
                        />
                        <Bar dataKey="Baseline" name={t('whatif.base')} fill="var(--text-muted)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Scenario" name={t('whatif.scenario')} fill="var(--teal)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Surplus stats line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.8125rem', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                    <span>{t('result.surplusLine')} <strong>₹{formatINR(whatifResult?.affordability_scenario?.monthly_surplus ?? data.affordability?.monthly_surplus)}{t('result.perMo')}</strong></span>
                    <span>{t('result.runwayLine')} <strong>{whatifResult?.affordability_scenario?.emergency_fund_months ?? '—'} {t('result.mos')}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SCHEMES FOR YOU                                            */}
        {/* ================================================================= */}
        {activeTab === 'schemes' && (
          <div className={styles.planSection} role="tabpanel" aria-labelledby="tab-schemes">
            {schemesLoading ? (
              <><SkeletonCard lines={3} /><SkeletonCard lines={3} /><SkeletonCard lines={3} /></>
            ) : schemesData ? (
              <>
                {/* Missed Summary Banner */}
                {schemesData.missed_summary?.count > 0 && (
                  <div className={styles.schemesBanner}>
                    <svg className={styles.bannerIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <div>
                      <h3 className={styles.bannerTitle}>{t('schemes.bannerTitle')}</h3>
                      <p className={styles.bannerDesc}>
                        {t('schemes.bannerDesc', {
                          count: schemesData.missed_summary.count,
                          amt: `₹${formatINR(schemesData.missed_summary.total_annual_inr)}`
                        })}
                        {schemesData.missed_summary.unquantified_count > 0 &&
                          t('schemes.unquantifiedNote', { count: schemesData.missed_summary.unquantified_count })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Scheme Cards List */}
                <div className={styles.schemesList}>
                  {schemesData.matched?.map((scheme) => {
                    const isUsing = scheme.my_status === 'using';
                    const eligClass = scheme.eligibility === 'eligible' 
                      ? styles.eligBadgeEligible 
                      : scheme.eligibility === 'likely' 
                        ? styles.eligBadgeLikely 
                        : styles.eligBadgeCheck;

                    const annualAmt = scheme.benefit?.annual_inr;
                    const monthlyAmt = scheme.benefit?.monthly_inr;

                    return (
                      <div key={scheme.scheme_id} className={styles.schemeMatchCard}>
                        <div className={styles.schemeTopRow}>
                          <div className={styles.schemeMainInfo}>
                            <h3 className={styles.schemeName}>{scheme.name}</h3>
                            <div className={styles.schemeChips}>
                              <span className={eligClass}>
                                {scheme.eligibility === 'eligible' ? t('schemes.eligible') : scheme.eligibility === 'likely' ? t('schemes.likely') : t('schemes.check')}
                              </span>
                              {scheme.matched_driver_key && (
                                <span className={styles.driverChip}>
                                  Addresses {scheme.matched_driver_key.replace('_', ' ').toUpperCase()}
                                </span>
                              )}
                              {scheme.category && (
                                <span className={styles.timeframeChip}>{scheme.category.toUpperCase()}</span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className={styles.schemeActions}>
                            <label className={styles.usingToggleLabel}>
                              <input
                                type="checkbox"
                                checked={isUsing}
                                onChange={() => handleToggleUsing(scheme.scheme_id, scheme.my_status)}
                              />
                              <span>{t('schemes.alreadyUsing')}</span>
                            </label>
                            <button
                              className={styles.checklistBtn}
                              onClick={() => {
                                setActiveSchemeForChecklist(scheme);
                                setChecklistOpen(true);
                              }}
                            >
                              {t('btn.applyChecklist')}
                            </button>
                          </div>
                        </div>

                        <p className={styles.schemeMatchReason}>{scheme.match_reason}</p>

                        <div className={styles.schemeBottomRow}>
                          <div className={styles.benefitBox}>
                            {annualAmt ? (
                              <>
                                <span className={styles.benefitMain}>₹{formatINR(annualAmt)}</span>
                                <span className={styles.benefitSub}>{t('schemes.perYear')}</span>
                                {monthlyAmt && (
                                  <span className={styles.benefitSub}> (₹{formatINR(monthlyAmt)}{t('schemes.perMonth')})</span>
                                )}
                              </>
                            ) : (
                              <span className={styles.benefitMain} style={{ fontSize: '0.9375rem' }}>
                                {scheme.benefit?.note || t('result.officialSupport')}
                              </span>
                            )}
                          </div>

                          {scheme.official_url && (
                            <a
                              href={scheme.official_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.benefitSub}
                              style={{ color: 'var(--teal)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <span>{t('btn.openPortal')}</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Mandatory Regulatory Disclaimer */}
        <footer className={styles.disclaimerFooter}>
          <p>
            <strong>{t('result.disclaimerLabel')}</strong> {planData?.disclaimer || t('result.disclaimer')}
          </p>
        </footer>
      </div>

      {/* Bottom Action Bar */}
      <div className={styles.actionBar}>
        <button className={styles.btnOutline} onClick={() => navigate('/assessment')}>
          {t('btn.retakeAssessment')}
        </button>
        <button
          className={styles.btnPrimary}
          onClick={handleDownloadPdf}
          disabled={pdfDownloading}
        >
          {pdfDownloading ? (
            <span>{t('btn.downloadingPdf')}</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>{t('btn.downloadPdf')}</span>
            </>
          )}
        </button>
      </div>

      {pdfError && <div style={{ color: 'var(--risk-high)', textAlign: 'right', marginTop: '0.5rem', fontSize: '0.8125rem' }}>{pdfError}</div>}

      {/* Checklist Drawer Modal */}
      <ChecklistDrawer
        isOpen={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        schemeId={activeSchemeForChecklist?.scheme_id}
        schemeName={activeSchemeForChecklist?.name}
      />
    </div>
  );
};

export default RiskResult;
