import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import Interviews from './Interviews';
import Resume from './Resume';
import PracticeTests from './PracticeTests';
import Resources from './Resources';
import SetupTest from './SetupTest';
import Schedule from './Schedule';
import Settings from './Settings';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const getUserName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0];
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case 'interviews':
        return <Interviews />;
      case 'resume':
        return <Resume />;
      case 'practice-tests':
        return <PracticeTests />;
      case 'resources':
        return <Resources />;
      case 'setup-test':
        return <SetupTest />;
      case 'schedule':
        return <Schedule />;
      case 'settings':
        return <Settings />;
      case 'dashboard':
      default:
        return (
          <div className={styles.dashboardContent}>
            <div className={styles.welcomeSection}>
              <h1 className={styles.welcomeTitle}>
                {greeting}, {getUserName()}! 👋
              </h1>
              <p className={styles.welcomeSubtitle}>
                Here's your interview preparation overview for February 2026.
              </p>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{color: '#2563EB'}}>🎤</div>
                <div className={styles.statContent}>
                  <div className={styles.statTitle}>Total Interviews</div>
                  <div className={styles.statValue}>0</div>
                  <div className={styles.statSubtext}>0 completed this month</div>
                  <div className={styles.statTrend}>+100%</div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{color: '#10b981'}}>📊</div>
                <div className={styles.statContent}>
                  <div className={styles.statTitle}>Average Score</div>
                  <div className={styles.statValue}>0</div>
                  <div className={styles.statSubtext}>No interviews yet</div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{color: '#f59e0b'}}>⏱️</div>
                <div className={styles.statContent}>
                  <div className={styles.statTitle}>Practice Time</div>
                  <div className={styles.statValue}>0h</div>
                  <div className={styles.statSubtext}>This month</div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{color: '#ef4444'}}>🎯</div>
                <div className={styles.statContent}>
                  <div className={styles.statTitle}>Improvement Areas</div>
                  <div className={styles.statValue}>0</div>
                  <div className={styles.statSubtext}>Needs attention</div>
                </div>
              </div>
            </div>

            {/* Sections Grid */}
            <div className={styles.sectionsGrid}>
              {/* Quick Actions */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Quick Actions</h3>
                  <button className={styles.viewAllBtn}>View All</button>
                </div>
                <div className={styles.actionsList}>
                  <div className={styles.actionItem}>
                    <div className={styles.actionIcon} style={{background: '#eff6ff', color: '#2563EB'}}>🎤</div>
                    <div className={styles.actionContent}>
                      <div className={styles.actionTitle}>Start New Interview</div>
                      <div className={styles.actionDesc}>Begin practice session</div>
                    </div>
                    <button className={styles.actionButton} onClick={() => handleNavigate('interviews')}>START</button>
                  </div>
                  <div className={styles.actionItem}>
                    <div className={styles.actionIcon} style={{background: '#f0f9ff', color: '#0ea5e9'}}>🔧</div>
                    <div className={styles.actionContent}>
                      <div className={styles.actionTitle}>System Check</div>
                      <div className={styles.actionDesc}>Test camera & microphone</div>
                    </div>
                    <button className={styles.actionButton} onClick={() => handleNavigate('setup-test')}>TEST</button>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Recent Activity</h3>
                  <button className={styles.viewAllBtn}>View All</button>
                </div>
                <div className={styles.activityList}>
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📝</div>
                    <p className={styles.emptyText}>No activity yet</p>
                    <p className={styles.emptySubtext}>Start your first interview to see progress</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPageContent()}
    </DashboardLayout>
  );
};

export default Dashboard;