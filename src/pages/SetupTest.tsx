import React from 'react';
import styles from './Dashboard.module.css';

const SetupTest: React.FC = () => {
  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Setup Test</h1>
        <p className={styles.welcomeSubtitle}>
          Test your camera, microphone, and system settings
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>System Check</h3>
        </div>
        <div className={styles.actionsList}>
          <div className={styles.actionItem}>
            <div className={styles.actionIcon}>📹</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Camera Test</div>
              <div className={styles.actionDesc}>Test your webcam</div>
            </div>
            <button className={styles.actionButton}>Test</button>
          </div>
          <div className={styles.actionItem}>
            <div className={styles.actionIcon}>🎤</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Microphone Test</div>
              <div className={styles.actionDesc}>Test your microphone</div>
            </div>
            <button className={styles.actionButton}>Test</button>
          </div>
          <div className={styles.actionItem}>
            <div className={styles.actionIcon}>🌐</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Connection Test</div>
              <div className={styles.actionDesc}>Test internet connection</div>
            </div>
            <button className={styles.actionButton}>Test</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupTest;