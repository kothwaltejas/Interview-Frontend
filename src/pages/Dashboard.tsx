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
import { DashboardHomeSkeleton } from '../components/SkeletonLoader';
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
  }, []);

  // Refetch every time user visits the dashboard tab
  useEffect(() => {
    if (currentPage === 'dashboard') {
      fetchDashboardData();
    }
  }, [currentPage]);

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
                <DashboardHomeSkeleton />
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

              {/* Stats Cards */}
              <div className={styles.statsContainer}>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <div className={`${styles.statIcon} ${styles.iconBlue}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                          <rect x="8" y="2" width="8" height="4" rx="1"/>
                          <path d="M9 14l2 2 4-4"/>
                        </svg>
                      </div>
                      <p className={styles.statLabel}>Total Interviews</p>
                    </div>
                    <div className={styles.statCardContent}>
                      <p className={styles.statValue}>{dashboardData?.statistics.total_interviews || 0}</p>
                      <p className={styles.statSubtext}>{dashboardData?.statistics.completed_this_month || 0} this month</p>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <div className={`${styles.statIcon} ${styles.iconGreen}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <p className={styles.statLabel}>Practice Time</p>
                    </div>
                    <div className={styles.statCardContent}>
                      <p className={styles.statValue}>{dashboardData?.statistics.total_practice_time_hours || 0}h</p>
                      <p className={styles.statSubtext}>Total hours</p>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <div className={`${styles.statIcon} ${styles.iconRed}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                      </div>
                      <p className={styles.statLabel}>Focus Areas</p>
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