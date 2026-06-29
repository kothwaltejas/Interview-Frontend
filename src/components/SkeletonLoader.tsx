import React from 'react';
import styles from './SkeletonLoader.module.css';

// Base skeleton block
export const SkeletonBlock: React.FC<{
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}> = ({ width = '100%', height = '1rem', borderRadius = '6px', className }) => (
  <div
    className={`${styles.skeleton} ${className || ''}`}
    style={{ width, height, borderRadius }}
  />
);

// Skeleton for a stat card (Dashboard home)
export const StatCardSkeleton: React.FC = () => (
  <div className={styles.statCardSkeleton}>
    <div className={styles.statCardHeader}>
      <SkeletonBlock width="48px" height="48px" borderRadius="8px" />
      <SkeletonBlock width="120px" height="0.9rem" />
    </div>
    <SkeletonBlock width="80px" height="2rem" borderRadius="8px" />
    <SkeletonBlock width="140px" height="0.75rem" />
  </div>
);

// Skeleton for the resume list items
export const ResumeItemSkeleton: React.FC = () => (
  <div className={styles.resumeItemSkeleton}>
    <div className={styles.resumeItemLeft}>
      <SkeletonBlock width="65%" height="1rem" />
      <SkeletonBlock width="45%" height="0.8rem" />
    </div>
    <div className={styles.resumeItemActions}>
      <SkeletonBlock width="36px" height="36px" borderRadius="6px" />
      <SkeletonBlock width="36px" height="36px" borderRadius="6px" />
    </div>
  </div>
);

// Skeleton for resume page
export const ResumeSkeleton: React.FC = () => (
  <div className={styles.resumeSkeleton}>
    {/* Header */}
    <div className={styles.skeletonHeader}>
      <SkeletonBlock width="200px" height="2rem" borderRadius="8px" />
      <SkeletonBlock width="300px" height="1rem" />
    </div>
    {/* Section */}
    <div className={styles.skeletonSection}>
      <div className={styles.skeletonSectionHeader}>
        <SkeletonBlock width="180px" height="1.125rem" />
        <SkeletonBlock width="150px" height="2rem" borderRadius="6px" />
      </div>
      <div className={styles.skeletonList}>
        <ResumeItemSkeleton />
        <ResumeItemSkeleton />
      </div>
    </div>
    {/* Preview placeholder */}
    <div className={styles.skeletonPreview}>
      <SkeletonBlock width="100%" height="500px" borderRadius="8px" />
    </div>
  </div>
);

// Skeleton for dashboard home
export const DashboardHomeSkeleton: React.FC = () => (
  <div className={styles.dashboardHomeSkeleton}>
    {/* Welcome section */}
    <div className={styles.skeletonWelcome}>
      <SkeletonBlock width="280px" height="2rem" borderRadius="8px" />
      <SkeletonBlock width="360px" height="1rem" />
      <SkeletonBlock width="220px" height="0.85rem" />
    </div>
    {/* Stat cards */}
    <div className={styles.statsGrid}>
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
    {/* Charts */}
    <div className={styles.chartsGrid}>
      <SkeletonBlock width="100%" height="260px" borderRadius="8px" />
      <SkeletonBlock width="100%" height="260px" borderRadius="8px" />
    </div>
  </div>
);

// Skeleton for Interviews page
export const InterviewsSkeleton: React.FC = () => (
  <div className={styles.genericPageSkeleton}>
    <div className={styles.skeletonWelcome}>
      <SkeletonBlock width="220px" height="2rem" borderRadius="8px" />
      <SkeletonBlock width="340px" height="1rem" />
    </div>
    <div className={styles.skeletonSection}>
      <div className={styles.skeletonSectionHeader}>
        <SkeletonBlock width="160px" height="1.125rem" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className={styles.interviewRowSkeleton}>
          <div className={styles.interviewRowLeft}>
            <SkeletonBlock width="44px" height="44px" borderRadius="8px" />
            <div>
              <SkeletonBlock width="180px" height="1rem" />
              <SkeletonBlock width="120px" height="0.8rem" />
            </div>
          </div>
          <SkeletonBlock width="80px" height="1.75rem" borderRadius="8px" />
        </div>
      ))}
    </div>
  </div>
);

// Skeleton for Settings page
export const SettingsSkeleton: React.FC = () => (
  <div className={styles.genericPageSkeleton}>
    <div className={styles.skeletonWelcome}>
      <SkeletonBlock width="150px" height="2rem" borderRadius="8px" />
      <SkeletonBlock width="280px" height="1rem" />
    </div>
    <div className={styles.skeletonSection}>
      <div className={styles.skeletonSectionHeader}>
        <SkeletonBlock width="180px" height="1.125rem" />
      </div>
      <div className={styles.settingsFieldSkeleton}>
        {['Full Name', 'Email', 'Experience Level', 'Phone'].map((_, i) => (
          <div key={i} className={styles.settingsFieldRow}>
            <SkeletonBlock width="100px" height="0.8rem" />
            <SkeletonBlock width="200px" height="1rem" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Skeleton for PracticeTests upload view
export const PracticeTestsSkeleton: React.FC = () => (
  <div className={styles.genericPageSkeleton}>
    <div className={styles.skeletonWelcome}>
      <SkeletonBlock width="260px" height="2rem" borderRadius="8px" />
      <SkeletonBlock width="320px" height="1rem" />
    </div>
    <div className={styles.skeletonSection}>
      <div className={styles.skeletonSectionHeader}>
        <SkeletonBlock width="150px" height="1.125rem" />
      </div>
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <SkeletonBlock width="100%" height="200px" borderRadius="8px" />
      </div>
    </div>
  </div>
);

export default SkeletonBlock;
