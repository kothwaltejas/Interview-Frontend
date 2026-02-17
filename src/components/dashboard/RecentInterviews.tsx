import React from 'react';
import styles from './RecentInterviews.module.css';

interface RecentInterview {
  id: string;
  job_role: string;
  score: number;
  completed_at: string;
  duration: number;
  status: string;
}

interface RecentInterviewsProps {
  data: RecentInterview[];
}

const RecentInterviews: React.FC<RecentInterviewsProps> = ({ data }) => {
  // Use provided data or fallback to sample data for demo
  const interviews = data.length > 0 ? data : [
    {
      id: '1',
      completed_at: '2026-02-17T14:30:00Z',
      job_role: 'Frontend Developer',
      score: 8.5,
      status: 'completed',
      duration: 25
    },
    {
      id: '2',
      completed_at: '2026-02-15T16:45:00Z',
      job_role: 'Backend Engineer',
      score: 7.8,
      status: 'completed',
      duration: 32
    },
    {
      id: '3',
      completed_at: '2026-02-14T10:20:00Z',
      job_role: 'Fullstack Developer',
      score: 9.2,
      status: 'completed',
      duration: 28
    },
    {
      id: '4',
      completed_at: '2026-02-12T13:15:00Z',
      job_role: 'Machine Learning',
      score: 6.9,
      status: 'completed',
      duration: 35
    }
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8.5) return styles.scoreHigh;
    if (score >= 7.0) return styles.scoreMedium;
    return styles.scoreLow;
  };

  const getRoleBadgeColor = (role: string) => {
    const roleMap: Record<string, string> = {
      'Frontend Developer': styles.roleFrontend,
      'Backend Engineer': styles.roleBackend,
      'Backend Developer': styles.roleBackend,
      'Fullstack Developer': styles.roleFullstack,
      'Machine Learning': styles.roleMl,
      'DevOps Engineer': styles.roleDevops
    };
    return `${styles.roleBadge} ${roleMap[role] || styles.roleBadge}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h3>Recent Interviews</h3>
          <p>Your latest practice sessions</p>
        </div>
        <button className={styles.viewAllBtn}>
          View All
        </button>
      </div>

      <div className={styles.tableContainer}>
        {/* Table Header - Hidden on mobile */}
        <div className={styles.tableHeader}>
          <div>Date</div>
          <div>Role</div>
          <div>Score</div>
          <div>Duration</div>
          <div>Status</div>
        </div>

        {/* Table Rows */}
        {interviews.length > 0 ? (
          interviews.map((interview) => (
            <React.Fragment key={interview.id}>
              {/* Desktop Layout */}
              <div className={styles.tableRow}>
                <div className={styles.dateCell}>
                  {formatDate(interview.completed_at)}
                </div>
                
                <div>
                  <span className={getRoleBadgeColor(interview.job_role)}>
                    {interview.job_role}
                  </span>
                </div>
                
                <div>
                  <span className={getScoreColor(interview.score)}>
                    {typeof interview.score === 'number' ? interview.score.toFixed(1) : '0.0'}/10
                  </span>
                </div>
                
                <div className={styles.durationText}>
                  {interview.duration}m
                </div>
                
                <div>
                  <div className={styles.statusDot}></div>
                </div>
              </div>

              {/* Mobile Layout */}
              <div className={styles.mobileRow}>
                <div className={styles.mobileRowTop}>
                  <span className={styles.dateCell}>
                    {formatDate(interview.completed_at)}
                  </span>
                  <span className={getScoreColor(interview.score)}>
                    {typeof interview.score === 'number' ? interview.score.toFixed(1) : '0.0'}/10
                  </span>
                </div>
                <div className={styles.mobileRowBottom}>
                  <span className={getRoleBadgeColor(interview.job_role)}>
                    {interview.job_role}
                  </span>
                  <span className={styles.durationText}>{interview.duration}m</span>
                </div>
              </div>
            </React.Fragment>
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6, color: '#9ca3af' }}>
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
            </div>
            <p className={styles.emptyText}>No interviews yet</p>
            <p className={styles.emptySubtext}>Start your first interview to see progress</p>
          </div>
        )}
      </div>

      {interviews.length > 0 && (
        <div className={styles.footer}>
          <span>Showing {Math.min(interviews.length, 5)} of {interviews.length} interviews</span>
          <span>Last updated: {new Date().toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
};

export default RecentInterviews;