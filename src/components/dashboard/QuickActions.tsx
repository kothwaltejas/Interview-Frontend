import React from 'react';
import styles from './QuickActions.module.css';

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  buttonText: string;
  buttonColor: string;
  iconBg: string;
  onClick: () => void;
}

interface QuickActionsProps {
  onNavigate: (page: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  const actions: QuickAction[] = [
    {
      title: 'Start New Interview',
      description: 'Begin practice session',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1c-2.76 0-5 2.24-5 5v5c0 2.76 2.24 5 5 5s5-2.24 5-5V6c0-2.76-2.24-5-5-5zm3 10c0 1.66-1.34 3-3 3s-3-1.34-3-3V6c0-1.66 1.34-3 3-3s3 1.34 3 3v5z"/>
          <path d="M19 12v.83c0 3.31-2.69 6-6 6H8.83c-3.31 0-6-2.69-6-6V12h2v.83c0 2.21 1.79 4 4 4H13c2.21 0 4-1.79 4-4V12h2z"/>
        </svg>
      ),
      buttonText: 'START',
      buttonColor: 'buttonBlue',
      iconBg: 'iconBlue',
      onClick: () => onNavigate('interviews')
    },
    {
      title: 'System Check',
      description: 'Test camera & microphone',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
        </svg>
      ),
      buttonText: 'TEST',
      buttonColor: 'buttonGreen',
      iconBg: 'iconGreen',
      onClick: () => onNavigate('setup-test')
    },
    {
      title: 'Schedule Interview',
      description: 'Book practice session',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
        </svg>
      ),
      buttonText: 'SCHEDULE',
      buttonColor: 'buttonPurple',
      iconBg: 'iconPurple',
      onClick: () => onNavigate('schedule')
    },
    {
      title: 'View Resources',
      description: 'Study materials & guides',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
        </svg>
      ),
      buttonText: 'BROWSE',
      buttonColor: 'buttonYellow',
      iconBg: 'iconYellow',
      onClick: () => onNavigate('resources')
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h3>Quick Actions</h3>
          <p>Common tasks and shortcuts</p>
        </div>
      </div>

      <div className={styles.actionsList}>
        {actions.map((action, index) => (
          <div 
            key={index}
            className={styles.actionItem}
          >
            {/* Icon */}
            <div className={`${styles.actionIcon} ${styles[action.iconBg]}`}>
              {action.icon}
            </div>

            {/* Content */}
            <div className={styles.actionContent}>
              <h4 className={styles.actionTitle}>
                {action.title}
              </h4>
              <p className={styles.actionDesc}>
                {action.description}
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={action.onClick}
              className={`${styles.actionButton} ${styles[action.buttonColor]}`}
            >
              {action.buttonText}
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerText}>Need help getting started?</span>
        <button className={styles.footerLink}>
          View Guide
        </button>
      </div>
    </div>
  );
};

export default QuickActions;