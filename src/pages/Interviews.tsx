import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';

const Interviews: React.FC = () => {
  const { user } = useAuth();

  const getUserName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0];
    }
    return user?.email?.split('@')[0] || 'User';
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Your Interviews</h1>
        <p className={styles.welcomeSubtitle}>
          Manage and track all your interview sessions
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Interview History</h3>
        </div>
        <div className={styles.activityList}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🎤</div>
            <p className={styles.emptyText}>No interviews yet</p>
            <p className={styles.emptySubtext}>Start your first interview to see your history here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Interviews;