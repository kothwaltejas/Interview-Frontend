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
            <div className={styles.emptyIcon}>📅</div>
            <p className={styles.emptyText}>No scheduled interviews</p>
            <p className={styles.emptySubtext}>Schedule your first interview to get started</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;