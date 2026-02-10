import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../pages/Dashboard.module.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, currentPage, onNavigate }) => {
  const { user, signOut } = useAuth();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const getUserDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const handleSignOut = async () => {
    await signOut();
    setShowProfileDropdown(false);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'interviews', label: 'Interviews', icon: '🎤' },
    { id: 'resume', label: 'Resume', icon: '📄' },
    { id: 'practice-tests', label: 'Practice Tests', icon: '🎯' },
    { id: 'resources', label: 'Resources', icon: '📚' },
    { id: 'setup-test', label: 'Setup Test', icon: '🔧' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className={styles.dashboardContainer}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>🎯</div>
            <h2>Intervu AI</h2>
          </div>
        </div>
        
        <nav className={styles.navigation}>
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={`${styles.navItem} ${currentPage === item.id ? styles.active : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Top Header */}
        <div className={styles.topHeader}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>
              {menuItems.find(item => item.id === currentPage)?.label || 'Dashboard'}
            </h1>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.notificationIcon}>
              🔔
            </div>

            <div className={styles.profileSection}>
              <button 
                className={styles.profileButton}
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              >
                <div className={styles.avatar}>
                  {getUserDisplayName().charAt(0).toUpperCase()}
                </div>
              </button>

              {showProfileDropdown && (
                <div className={styles.profileDropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownAvatar}>
                      {getUserDisplayName().charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.dropdownUserInfo}>
                      <div className={styles.dropdownName}>{getUserDisplayName()}</div>
                      <div className={styles.dropdownEmail}>{user?.email}</div>
                    </div>
                  </div>
                  <hr className={styles.dropdownDivider} />
                  <button className={styles.dropdownItem} onClick={() => onNavigate('settings')}>
                    Settings
                  </button>
                  <button className={styles.dropdownItem} onClick={handleSignOut}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;