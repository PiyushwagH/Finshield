import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import styles from './Skeleton.module.css';

export const Skeleton = ({ width, height, radius, circle = false, className = '' }) => (
  <span
    className={`${styles.block} ${circle ? styles.circle : ''} ${className}`}
    style={{ '--sk-w': width, '--sk-h': height, '--sk-r': radius }}
    aria-hidden="true"
  />
);

// Wraps any skeleton layout so screen readers announce a single "loading"
// status instead of reading out a pile of empty blocks.
const Region = ({ label, className, children }) => {
  const { t } = useLanguage();
  return (
    <div className={className} role="status" aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>{label || t('common.loading')}</span>
      {children}
    </div>
  );
};

export const SkeletonText = ({ lines = 3, lastWidth = '60%' }) => (
  <div className={styles.lines}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} height="0.85rem" width={i === lines - 1 ? lastWidth : '100%'} />
    ))}
  </div>
);

export const SkeletonCard = ({ lines = 3 }) => (
  <div className={styles.card}>
    <Skeleton width="45%" height="1.1rem" />
    <SkeletonText lines={lines} />
  </div>
);

const PageHeader = ({ withAction = true }) => (
  <div className={styles.header}>
    <div className={styles.headerText}>
      <Skeleton width="40%" height="1.75rem" />
      <Skeleton width="60%" height="0.9rem" />
    </div>
    {withAction && <Skeleton width="160px" height="2.5rem" radius="8px" />}
  </div>
);

export const DashboardSkeleton = ({ label }) => (
  <Region label={label} className={styles.page}>
    <PageHeader />
    <div className={styles.statGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.card}>
          <Skeleton width="50%" height="0.9rem" />
          <Skeleton width="70%" height="2rem" />
          <Skeleton width="40%" height="0.75rem" />
        </div>
      ))}
    </div>
    <div className={styles.twoCol}>
      <SkeletonCard lines={5} />
      <div className={styles.card}>
        <Skeleton width="45%" height="1.1rem" />
        <Skeleton height="180px" radius="8px" />
      </div>
    </div>
  </Region>
);

export const CardGridSkeleton = ({ count = 6, label }) => (
  <Region label={label} className={styles.cardGrid}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={styles.card}>
        <div className={styles.row}>
          <Skeleton width="70px" height="1.4rem" radius="999px" />
          <Skeleton width="60px" height="1.4rem" radius="999px" />
        </div>
        <Skeleton width="85%" height="1.15rem" />
        <SkeletonText lines={2} lastWidth="70%" />
        <Skeleton width="100%" height="2.4rem" radius="8px" />
      </div>
    ))}
  </Region>
);

export const ListPageSkeleton = ({ count = 6, label }) => (
  <div className={styles.page}>
    <PageHeader />
    <CardGridSkeleton count={count} label={label} />
  </div>
);

export const DetailSkeleton = ({ label }) => (
  <Region label={label} className={styles.page}>
    <Skeleton width="35%" height="0.85rem" />
    <div className={styles.headerText}>
      <Skeleton width="55%" height="2rem" />
      <Skeleton width="30%" height="0.9rem" />
      <div className={styles.row}>
        <Skeleton width="110px" height="1.5rem" radius="999px" />
        <Skeleton width="90px" height="1.5rem" radius="999px" />
        <Skeleton width="80px" height="1.5rem" radius="999px" />
      </div>
    </div>
    <div className={styles.twoCol}>
      <div className={styles.card}>
        <div className={styles.row}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="90px" height="1.8rem" radius="6px" />
          ))}
        </div>
        <SkeletonText lines={6} />
      </div>
      <div className={styles.card}>
        <Skeleton width="60%" height="1.5rem" radius="999px" />
        <Skeleton height="2.6rem" radius="8px" />
        <Skeleton height="2.6rem" radius="8px" />
      </div>
    </div>
  </Region>
);

export const ResultSkeleton = ({ label }) => (
  <Region label={label} className={styles.page}>
    <div className={styles.headerText}>
      <Skeleton width="40%" height="1.75rem" />
      <Skeleton width="55%" height="0.9rem" />
    </div>
    <div className={styles.card}>
      <div className={styles.gaugeWrap}>
        <Skeleton width="240px" height="120px" radius="120px 120px 0 0" />
        <Skeleton width="90px" height="2.25rem" />
        <Skeleton width="110px" height="1.6rem" radius="999px" />
        <Skeleton width="70%" height="0.9rem" />
      </div>
    </div>
    <div className={styles.twoCol}>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={4} />
    </div>
  </Region>
);

export const FormSkeleton = ({ fields = 6, label }) => (
  <Region label={label} className={styles.page}>
    <div className={styles.row}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} width="25%" height="0.5rem" radius="999px" />
      ))}
    </div>
    <div className={styles.card}>
      <Skeleton width="35%" height="1.5rem" />
      <Skeleton width="60%" height="0.9rem" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className={styles.lines}>
          <Skeleton width="25%" height="0.8rem" />
          <Skeleton height="2.6rem" radius="8px" />
        </div>
      ))}
    </div>
  </Region>
);

export const TableRowsSkeleton = ({ rows = 5, cols = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className={styles.tableRow} aria-hidden="true">
        {Array.from({ length: cols }).map((_, c) => (
          <td key={c}>
            <Skeleton width={c === 0 ? '80%' : '60%'} height="0.9rem" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const ListItemsSkeleton = ({ count = 3, label }) => (
  <Region label={label} className={styles.lines}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={styles.card}>
        <div className={styles.row}>
          <Skeleton width="36px" height="36px" circle />
          <div className={styles.headerText}>
            <Skeleton width="50%" height="0.95rem" />
            <Skeleton width="35%" height="0.8rem" />
          </div>
        </div>
      </div>
    ))}
  </Region>
);

export const RouteSkeleton = () => (
  <div className={styles.routeFallback}>
    <DashboardSkeleton />
  </div>
);
