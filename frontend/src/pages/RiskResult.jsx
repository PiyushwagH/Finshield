import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import apiClient from '../api/client';
import { mapRiskBand } from '../utils/riskBand';
import styles from './RiskResult.module.css';

// English ordinal suffix (1st, 2nd, 3rd, 4th...), with the 11-13 exception.
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

const SemicircularGauge = ({ score }) => {
  const minScore = 300;
  const maxScore = 850;
  const clampedScore = Math.max(minScore, Math.min(maxScore, score || 300));
  const percentage = (clampedScore - minScore) / (maxScore - minScore);
  
  // Angle from -90 deg to 90 deg
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
          {/* Needle sweeps left (score 300) to right (score 850) as the score
              rises. Higher score = safer, so the gradient must run red at the
              low-score end and green at the high-score end - previously it
              ran the other way, so a good score pointed straight at red. */}
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
        <span className={styles.scoreMax}>out of 850</span>
      </div>
    </div>
  );
};

const RiskResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `FinShield_Risk_Report_${id}`,
  });

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await apiClient.get(`/risk/assessments/${id}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load risk assessment.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchResult();
  }, [id]);

  if (loading) return <div className={styles.loading}>Loading assessment results...</div>;
  if (error || !data) return <div className={styles.error}>{error || 'Result not found'}</div>;

  const mappedBand = mapRiskBand(data.risk_band);
  const defProbPct = (data.default_probability * 100).toFixed(1);
  const popRate = data.model_meta?.population_default_rate 
    ? (data.model_meta.population_default_rate * 100).toFixed(1) 
    : '8.1';

  return (
    <div className={styles.container}>
      <div className={styles.printableArea} ref={printRef}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Assessment Results</h1>
            <p className={styles.subtitle}>Comprehensive review of your financial standing.</p>
          </div>
        </div>

        {/* Top Hero Card with Gauge */}
        <div className={styles.card}>
          <SemicircularGauge score={data.risk_score} />
          
          <div className={styles.bandBadgeContainer}>
            <span className={`${styles.bandBadge} ${styles['band' + mappedBand]}`}>
              {mappedBand.toUpperCase()} RISK
            </span>
          </div>

          <p className={styles.sentence}>
            Your estimated probability of financial default is <strong>{defProbPct}%</strong>, compared to a population average of <strong>{popRate}%</strong>.
          </p>

          <p className={styles.percentileLine}>
            You are in the <strong>{Math.round(data.population_percentile)}{ordinalSuffix(Math.round(data.population_percentile))} percentile</strong> of risk.
          </p>
        </div>

        <div className={styles.twoColumnGrid}>
          {/* Driver Factors */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>What's driving your score</h2>

            {data.factors?.positive?.length > 0 && (
              <div className={styles.factorGroup}>
                <h3 className={styles.positiveHeader}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                  WORKING IN YOUR FAVOUR
                </h3>
                <ul className={styles.factorList}>
                  {data.factors.positive.map((factor, idx) => (
                    <li key={idx} className={styles.factorItemPositive}>
                      <span>{factor}</span>
                      <span className={styles.tagPos}>+Positive</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.factors?.negative?.length > 0 && (
              <div className={styles.factorGroup}>
                <h3 className={styles.negativeHeader}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                  RAISING YOUR RISK
                </h3>
                <ul className={styles.factorList}>
                  {data.factors.negative.map((factor, idx) => (
                    <li key={idx} className={styles.factorItemNegative}>
                      <span>{factor}</span>
                      <span className={styles.tagNeg}>-Risk</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Affordability Check */}
          <div className={styles.card}>
            <div className={styles.cardHeaderFlex}>
              <h2 className={styles.cardTitle}>Affordability Check</h2>
              <span className={styles.gradeBadge}>{data.affordability?.grade || 'Standard'}</span>
            </div>

            <div className={styles.affordabilityRows}>
              <div className={styles.affRow}>
                <span>Monthly Surplus</span>
                <strong>₹{data.affordability?.monthly_surplus?.toLocaleString('en-IN') ?? 0}</strong>
              </div>
              <div className={styles.affRow}>
                <span>Surplus Ratio</span>
                <strong>{((data.affordability?.surplus_ratio || 0) * 100).toFixed(1)}%</strong>
              </div>
              <div className={styles.affRow}>
                <span>EMI-to-Income Ratio</span>
                <strong>{((data.affordability?.emi_to_income_ratio || 0) * 100).toFixed(1)}%</strong>
              </div>
              <div className={styles.affRow}>
                <span>Emergency Fund Months</span>
                <strong>{data.affordability?.emergency_fund_months ?? 'N/A'} Months</strong>
              </div>
            </div>

            {data.affordability?.flags?.length > 0 && (
              <div className={styles.flagsBox}>
                <h4 className={styles.flagsTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                  Flags Detected
                </h4>
                <ul>
                  {data.affordability.flags.map((flag, idx) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Personalized Action Plan */}
        {data.advice?.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Your Personalized Action Plan</h2>
            <div className={styles.actionGrid}>
              {data.advice.map((item, idx) => (
                <div key={idx} className={styles.actionCard}>
                  <div className={styles.actionHeader}>
                    <span className={`${styles.priorityTag} ${styles['prio' + item.priority]}`}>
                      {item.priority} Priority
                    </span>
                  </div>
                  <h4 className={styles.actionTitle}>{item.title}</h4>
                  <p className={styles.actionBody}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mandatory Rule 7 Disclaimer */}
        <footer className={styles.disclaimerFooter}>
          <p>
            <strong>Disclaimer:</strong> This risk score and assessment output is an indicative estimate generated by FinShield's trained machine learning model for informational purposes only. It does not constitute a formal credit decision, financial advice, or a binding guarantee of eligibility for any loan or government scheme.
          </p>
        </footer>
      </div>

      {/* Bottom Action Bar */}
      <div className={styles.actionBar}>
        <button className={styles.btnOutline} onClick={() => navigate('/assessment')}>
          Retake Assessment
        </button>
        <button className={styles.btnPrimary} onClick={handlePrint}>
          Download PDF Report
        </button>
      </div>
    </div>
  );
};

export default RiskResult;
