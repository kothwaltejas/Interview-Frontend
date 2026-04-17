import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../pages/Dashboard.module.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    id: 'practice-tests',
    label: 'Interview Lab',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
  },
  {
    id: 'interviews',
    label: 'My Interviews',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h8v2H8v-2zm0-3h8v2H8v-2zm0-3h5v2H8v-2z" />
      </svg>
    ),
  },
  {
    id: 'resume',
    label: 'Resume',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z" />
      </svg>
    ),
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" />
      </svg>
    ),
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.89 3 3.01 3.9 3.01 5L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    ),
  },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, currentPage, onNavigate }) => {
  const { user, signOut } = useAuth();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [upcomingAlerts, setUpcomingAlerts] = useState<Array<{id: string; title: string; label: string}>>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Check schedule for upcoming interviews every minute
  useEffect(() => {
    const checkSchedule = () => {
      try {
        const raw = localStorage.getItem('interviewai_schedule');
        if (!raw) return;
        const schedule: Array<{id: string; title: string; scheduled_at: string}> = JSON.parse(raw);
        const now = new Date();
        const alerts = schedule
          .filter(s => {
            const diff = new Date(s.scheduled_at).getTime() - now.getTime();
            return diff > 0 && diff <= 3 * 60 * 60 * 1000; // within 3 hours
          })
          .map(s => {
            const diff = new Date(s.scheduled_at).getTime() - now.getTime();
            const hours = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const label = hours > 0 ? `in ${hours}h ${mins}m` : `in ${mins}m`;
            return { id: s.id, title: s.title, label };
          });
        setUpcomingAlerts(alerts);
      } catch { /* ignore */ }
    };
    checkSchedule();
    const t = setInterval(checkSchedule, 60000);
    return () => clearInterval(t);
  }, []);

  const visibleAlerts = upcomingAlerts.filter(a => !dismissedAlerts.has(a.id));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    return user?.email?.split('@')[0] || 'User';
  };

  const getInitial = () => getDisplayName().charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    setShowProfileDropdown(false);
  };

  const currentItem = menuItems.find(m => m.id === currentPage);

  return (
    <div className={styles.dashboardContainer}>
      {/* ─── Sidebar ─── */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <h2>Intervu AI</h2>
          </div>
        </div>

        <nav className={styles.navigation}>
          {menuItems.map(item => (
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

        {/* Sidebar user card */}
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUserCard} onClick={() => onNavigate('settings')}>
            <div className={styles.sidebarAvatar}>{getInitial()}</div>
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>{getDisplayName()}</div>
              <div className={styles.sidebarUserEmail}>{user?.email}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,.4)">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className={styles.mainContent}>
        {/* Top Header */}
        <div className={styles.topHeader}>
          <div className={styles.headerLeft}>
            <div>
              <h1 className={styles.pageTitle}>{currentItem?.label || 'Dashboard'}</h1>
            </div>
          </div>

          <div className={styles.headerRight}>
            {/* Notification bell — shows badge when upcoming sessions exist */}
            <div
              className={styles.headerIconBtn}
              title="Scheduled Interviews"
              onClick={() => onNavigate('schedule')}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
              {visibleAlerts.length > 0 ? (
                <span style={{
                  position: 'absolute', top: '-3px', right: '-3px',
                  background: '#ef4444', color: 'white', borderRadius: '999px',
                  fontSize: '10px', fontWeight: 700, minWidth: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                }}>{visibleAlerts.length}</span>
              ) : (
                <span className={styles.notificationDot} />
              )}
            </div>

            {/* Profile button */}
            <div className={styles.profileSection} ref={dropdownRef}>
              <button
                className={styles.profileButton}
                onClick={() => setShowProfileDropdown(p => !p)}
              >
                <div className={styles.avatar}>{getInitial()}</div>
                <span className={styles.profileName}>{getDisplayName()}</span>
                <svg className={styles.profileChevron} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>

              {showProfileDropdown && (
                <div className={styles.profileDropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownAvatar}>{getInitial()}</div>
                    <div className={styles.dropdownUserInfo}>
                      <div className={styles.dropdownName}>{getDisplayName()}</div>
                      <div className={styles.dropdownEmail}>{user?.email}</div>
                    </div>
                  </div>
                  <hr className={styles.dropdownDivider} />
                  <button className={styles.dropdownItem} onClick={() => { onNavigate('settings'); setShowProfileDropdown(false); }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                    <span>My Profile</span>
                  </button>
                  <button className={styles.dropdownItem} onClick={() => { onNavigate('settings'); setShowProfileDropdown(false); }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58z" /></svg>
                    <span>Settings</span>
                  </button>
                  <hr className={styles.dropdownDivider} />
                  <button className={`${styles.dropdownItem} ${styles.logoutItem}`} onClick={handleSignOut}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" /></svg>
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Schedule Alerts ─────────────────────────────────── */}
        {visibleAlerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', padding: '0 1.75rem', marginTop: '-.25rem' }}>
            {visibleAlerts.map(alert => (
              <div key={alert.id} style={{
                display: 'flex', alignItems: 'center', gap: '.875rem',
                background: 'linear-gradient(90deg,#fef3c7,#fffbeb)',
                border: '1.5px solid #fcd34d', borderRadius: '10px',
                padding: '.625rem 1.125rem',
              }}>
                <span style={{ fontSize: '1.1rem' }}>⏰</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: '#92400e', fontSize: '.875rem' }}>Upcoming: </span>
                  <span style={{ color: '#78350f', fontSize: '.875rem' }}>{alert.title}</span>
                  <span style={{ color: '#b45309', fontSize: '.8rem', marginLeft: '.5rem' }}>({alert.label})</span>
                </div>
                <button
                  onClick={() => onNavigate('schedule')}
                  style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px',
                    padding: '.3rem .75rem', fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >View</button>
                <button
                  onClick={() => setDismissedAlerts(s => new Set([...s, alert.id]))}
                  style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '.2rem .4rem' }}
                  title="Dismiss"
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;