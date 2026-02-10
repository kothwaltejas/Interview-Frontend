import React from 'react';
import styles from './Dashboard.module.css';

const Resources: React.FC = () => {
  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Resources</h1>
        <p className={styles.welcomeSubtitle}>
          Study materials and guides for interview preparation
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Study Resources</h3>
        </div>
        <div className={styles.activityList}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📚</div>
            <p className={styles.emptyText}>No resources available</p>
            <p className={styles.emptySubtext}>Study materials coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Resources;