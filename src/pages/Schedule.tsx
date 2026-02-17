import React from 'react';
import styles from './Dashboard.module.css';

const Schedule: React.FC = () => {
  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Schedule</h1>
        <p className={styles.welcomeSubtitle}>
          Schedule and manage your interview sessions
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Upcoming Sessions</h3>
        </div>
        <div className={styles.activityList}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <p className={styles.emptyText}>No scheduled interviews</p>
            <p className={styles.emptySubtext}>Schedule your first interview to get started</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;