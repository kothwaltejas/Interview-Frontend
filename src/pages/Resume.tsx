import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';

const Resume: React.FC = () => {
  const { user } = useAuth();
  const [resume, setResume] = useState<string | null>(null);

  useEffect(() => {
    // Get resume from user metadata
    const resumeUrl = user?.user_metadata?.resume_url;
    if (resumeUrl) {
      setResume(resumeUrl);
    }
  }, [user]);

  const getUserName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0];
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const handleResumeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      // Create object URL for preview
      const url = URL.createObjectURL(file);
      setResume(url);
      // In a real app, you would upload this to Supabase storage
      console.log('Resume uploaded:', file.name);
    }
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Your Resume</h1>
        <p className={styles.welcomeSubtitle}>
          View and manage your resume for interview preparation
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Resume Management</h3>
          <label className={styles.actionButton} style={{cursor: 'pointer'}}>
            Upload New Resume
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleResumeUpload}
              style={{display: 'none'}}
            />
          </label>
        </div>
        
        {resume ? (
          <div style={{padding: '1.5rem'}}>
            <div style={{
              width: '100%',
              height: '600px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <iframe 
                src={resume}
                width="100%"
                height="100%"
                style={{border: 'none'}}
                title="Resume Preview"
              />
            </div>
            <div style={{marginTop: '1rem', textAlign: 'center'}}>
              <p style={{color: '#64748b', fontSize: '0.875rem'}}>
                Resume uploaded during registration
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.activityList}>
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📄</div>
              <p className={styles.emptyText}>No resume uploaded</p>
              <p className={styles.emptySubtext}>Upload your resume to get started with interview preparation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Resume;