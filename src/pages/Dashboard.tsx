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
import TrendChart from '../components/dashboard/TrendChart';
import RoleDistributionChart from '../components/dashboard/RoleDistributionChart';
import RecentInterviews from '../components/dashboard/RecentInterviews';
import AIPerformanceMetrics from '../components/dashboard/AIPerformanceMetrics';
import QuickActions from '../components/dashboard/QuickActions';
import { ApiService, DashboardData } from '../services/api';
import styles from './DashboardHome.module.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [greeting, setGreeting] = useState('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    // Fetch dashboard data when component mounts
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getDashboardData();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        if (loading) {
          return (
            <div className={styles.dashboardWrapper}>
              <div className={styles.dashboardContainer}>
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner}></div>
                  <p>Loading dashboard...</p>
                </div>
              </div>
            </div>
          );
        }

        if (error) {
          return (
            <div className={styles.dashboardWrapper}>
              <div className={styles.dashboardContainer}>
                <div className={styles.errorState}>
                  <p className={styles.errorMessage}>{error}</p>
                  <button 
                    className={styles.retryButton} 
                    onClick={fetchDashboardData}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className={styles.dashboardWrapper}>
            <div className={styles.dashboardContainer}>
              {/* Header Section */}
              <div className={styles.headerSection}>
                <div className={styles.headerContent}>
                  <h1 className={styles.greeting}>
                    {greeting}, {getUserName()}! 👋
                  </h1>
                  <p className={styles.subtitle}>
                    Here's your interview preparation overview for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
                  </p>
                  <p className={styles.dateText}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Stats Cards Section */}
              <div className={styles.statsContainer}>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <div className={`${styles.statIcon} ${styles.iconBlue}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 1c-2.76 0-5 2.24-5 5v5c0 2.76 2.24 5 5 5s5-2.24 5-5V6c0-2.76-2.24-5-5-5zm3 10c0 1.66-1.34 3-3 3s-3-1.34-3-3V6c0-1.66 1.34-3 3-3s3 1.34 3 3v5zm-3 6c-4 0-7.3-3.14-7.83-7H1v2c0 4.97 4.03 9 9 9h4c4.97 0 9-4.03 9-9v-2h-3.17C19.3 13.86 16 17 12 17z"/>
                        </svg>
                      </div>
                      <p className={styles.statLabel}>Total Interviews</p>
                    </div>
                    <div className={styles.statCardContent}>
                      <p className={styles.statValue}>{dashboardData?.statistics.total_interviews || 0}</p>
                      <p className={styles.statSubtext}>{dashboardData?.statistics.completed_this_month || 0} completed this month</p>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <div className={`${styles.statIcon} ${styles.iconGreen}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22 21H2v-2h2V7h4v12h4V3h4v16h4V9h4v10h2v2z"/>
                        </svg>
                      </div>
                      <p className={styles.statLabel}>Average Score</p>
                    </div>
                    <div className={styles.statCardContent}>
                      <p className={styles.statValue}>{dashboardData?.statistics.average_score ? dashboardData.statistics.average_score.toFixed(1) : '0.0'}</p>
                      <p className={`${styles.statSubtext} ${
                        (dashboardData?.statistics.score_change || 0) >= 0 ? styles.positive : styles.negative
                      }`}>
                        {(dashboardData?.statistics.score_change || 0) >= 0 ? '+' : ''}
                        {dashboardData?.statistics.score_change ? dashboardData.statistics.score_change.toFixed(1) : '0.0'} from last month
                      </p>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <div className={`${styles.statIcon} ${styles.iconYellow}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                        </svg>
                      </div>
                      <p className={styles.statLabel}>Practice Time</p>
                    </div>
                    <div className={styles.statCardContent}>
                      <p className={styles.statValue}>{dashboardData?.statistics.total_practice_time_hours || 0}h</p>
                      <p className={styles.statSubtext}>This month</p>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <div className={`${styles.statIcon} ${styles.iconRed}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                      </div>
                      <p className={styles.statLabel}>Improvement Areas</p>
                    </div>
                    <div className={styles.statCardContent}>
                      <p className={styles.statValue}>{dashboardData?.statistics.improvement_areas || 0}</p>
                      <p className={`${styles.statSubtext} ${
                        (dashboardData?.statistics.improvement_areas || 0) > 0 ? styles.warning : ''
                      }`}>
                        {(dashboardData?.statistics.improvement_areas || 0) > 0 ? 'Needs attention' : 'All good!'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analytics Section (Trend + Pie) */}
              <div className={styles.chartsGrid}>
                <TrendChart data={dashboardData?.chartData.monthly_trends || []} />
                <RoleDistributionChart data={dashboardData?.chartData.role_distribution || []} />
              </div>

              {/* AI Performance Summary */}
              <div className={styles.performanceSection}>
                <div className={styles.sectionHeader}>
                  <h2>AI Performance Summary</h2>
                  <p>Detailed analysis of your interview skills</p>
                </div>
                <AIPerformanceMetrics />
              </div>

              {/* Quick Actions + Recent Interviews */}
              <div className={styles.quickActionsGrid}>
                <div className={styles.quickActionsCol}>
                  <QuickActions onNavigate={handleNavigate} />
                </div>
                <div className={styles.recentInterviewsCol}>
                  <RecentInterviews data={dashboardData?.recentInterviews || []} />
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