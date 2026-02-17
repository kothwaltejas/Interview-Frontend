import React, { useState } from 'react';
import styles from './Dashboard.module.css';

const Resume: React.FC = () => {
  const [resume, setResume] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setIsUploading(true);
      try {
        // Create object URL for preview
        const url = URL.createObjectURL(file);
        setResume(url);
        console.log('Resume uploaded:', file.name);
      } catch (error) {
        console.error('Error uploading resume:', error);
      } finally {
        setIsUploading(false);
      }
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
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z"/>
            </svg>
            Resume Management
          </h3>
          <label className={styles.actionButton} style={{cursor: 'pointer'}}>
            {isUploading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 6V2l-5 5 5 5V8c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C18.6 17.33 19 15.7 19 14c0-3.87-3.13-7-7-7z"/>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                </svg>
                Upload New Resume
              </>
            )}
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleResumeUpload}
              style={{display: 'none'}}
              disabled={isUploading}
            />
          </label>
        </div>
        
        {resume ? (
          <div style={{padding: '1.5rem'}}>
            <div style={{
              width: '100%',
              height: '600px',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#f8fafc'
            }}>
              <iframe 
                src={resume}
                width="100%"
                height="100%"
                style={{border: 'none'}}
                title="Resume Preview"
              />
            </div>
            <div style={{marginTop: '1rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '1rem'}}>
              <button 
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  color: '#64748b',
                  cursor: 'pointer'
                }}
                onClick={() => window.open(resume, '_blank')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{marginRight: '0.5rem'}}>
                  <path d="M19 19H5V5h7V3H5C3.89 3 3 3.9 3 5v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                </svg>
                View Full Screen
              </button>
              <button 
                style={{
                  background: '#dc2626',
                  border: '1px solid #dc2626',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  color: 'white',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  URL.revokeObjectURL(resume);
                  setResume(null);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{marginRight: '0.5rem'}}>
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.activityList}>
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{color: '#94a3b8'}}>
                  <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z"/>
                </svg>
              </div>
              <p className={styles.emptyText}>No resume uploaded</p>
              <p className={styles.emptySubtext}>Upload your resume to get started with interview preparation</p>
              <div style={{marginTop: '1.5rem'}}>
                <label className={styles.actionButton} style={{cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                  </svg>
                  Choose File
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleResumeUpload}
                    style={{display: 'none'}}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Resume;