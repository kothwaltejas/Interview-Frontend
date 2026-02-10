import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();

  const getUserDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const getExperienceLevel = () => {
    const experience = user?.user_metadata?.experience_level;
    if (!experience) return 'Not specified';
    
    const levels = {
      'fresher': 'Fresher (0-1 years)',
      'junior': 'Junior (1-3 years)',
      'mid': 'Mid-level (3-5 years)',
      'senior': 'Senior (5+ years)',
      'lead': 'Lead/Manager'
    };
    
    return levels[experience as keyof typeof levels] || experience;
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Settings</h1>
        <p className={styles.welcomeSubtitle}>
          Manage your account and preferences
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Profile Information</h3>
        </div>
        <div style={{padding: '1.5rem'}}>
          <div style={{display: 'grid', gap: '1rem'}}>
            <div>
              <label style={{color: '#64748b', fontSize: '0.875rem', fontWeight: 500}}>Full Name</label>
              <div style={{padding: '0.75rem 0', color: '#1e293b', fontWeight: 500}}>{getUserDisplayName()}</div>
            </div>
            <div>
              <label style={{color: '#64748b', fontSize: '0.875rem', fontWeight: 500}}>Email</label>
              <div style={{padding: '0.75rem 0', color: '#1e293b', fontWeight: 500}}>{user?.email}</div>
            </div>
            <div>
              <label style={{color: '#64748b', fontSize: '0.875rem', fontWeight: 500}}>Experience Level</label>
              <div style={{padding: '0.75rem 0', color: '#1e293b', fontWeight: 500}}>{getExperienceLevel()}</div>
            </div>
            <div>
              <label style={{color: '#64748b', fontSize: '0.875rem', fontWeight: 500}}>Phone</label>
              <div style={{padding: '0.75rem 0', color: '#1e293b', fontWeight: 500}}>
                {user?.user_metadata?.phone || 'Not provided'}
              </div>
            </div>
          </div>
          <div style={{marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0'}}>
            <button 
              onClick={signOut}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;