import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService, supabase } from '../lib/supabase';
import styles from './Dashboard.module.css';
import resumeStyles from './Resume.module.css';
import { ResumeSkeleton } from '../components/SkeletonLoader';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface ResumeItem {
  id: string;
  file_name: string;
  file_url: string;
  file_size_bytes?: number;
  file_size?: number;
  created_at: string;
  parsed_json?: any;
}

const getFileSize = (r: ResumeItem) => r.file_size_bytes ?? r.file_size ?? 0;

const Resume: React.FC = () => {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // PDF viewer modal (NOT auto-open — only on explicit click)
  const [viewModal, setViewModal] = useState<{ open: boolean; resume: ResumeItem | null }>({
    open: false,
    resume: null,
  });

  // Confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    resumeId: string | null;
    fileName: string;
  }>({ open: false, resumeId: null, fileName: '' });

  useEffect(() => {
    if (user) fetchResumes();
  }, [user]);

  // Close modal with Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewModal({ open: false, resume: null });
        setDeleteConfirm({ open: false, resumeId: null, fileName: '' });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const fetchResumes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await authService.getValidAccessToken();

      const res = await fetch(`${API_BASE_URL}/api/db/resumes`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || 'Failed to fetch resumes');
      }
      const data = await res.json();
      setResumes(data.resumes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resumes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file'); return; }

    setIsUploading(true);
    setError(null);
    try {
      const token = await authService.getValidAccessToken();

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/api/db/resumes/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }
      showSuccess('Resume uploaded successfully! ✅');
      await fetchResumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const openDeleteConfirm = (resumeId: string, fileName: string) =>
    setDeleteConfirm({ open: true, resumeId, fileName });

  const closeDeleteConfirm = () =>
    setDeleteConfirm({ open: false, resumeId: null, fileName: '' });

  const confirmDelete = async () => {
    if (!deleteConfirm.resumeId) return;
    const resumeId = deleteConfirm.resumeId;
    closeDeleteConfirm();
    setIsDeleting(resumeId);
    // If the currently viewed resume is being deleted, close the modal
    if (viewModal.resume?.id === resumeId) setViewModal({ open: false, resume: null });

    try {
      const token = await authService.getValidAccessToken();

      const res = await fetch(`${API_BASE_URL}/api/db/resumes/${resumeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || 'Delete failed');
      }
      showSuccess('Resume deleted successfully.');
      await fetchResumes();
    } catch {
      setError('Failed to delete resume. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.dashboardContent}>
        <ResumeSkeleton />
      </div>
    );
  }

  return (
    <>
      {/* ─── PDF Viewer Modal ─── */}
      {viewModal.open && viewModal.resume && (
        <div
          className={resumeStyles.modalOverlay}
          onClick={() => setViewModal({ open: false, resume: null })}
        >
          <div
            className={resumeStyles.pdfModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Viewing ${viewModal.resume.file_name}`}
          >
            {/* Modal Header */}
            <div className={resumeStyles.pdfModalHeader}>
              <div className={resumeStyles.pdfModalTitle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" />
                </svg>
                <span>{viewModal.resume.file_name}</span>
                <span className={resumeStyles.pdfModalMeta}>
                  {(getFileSize(viewModal.resume) / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className={resumeStyles.pdfModalActions}>
                <button
                  className={resumeStyles.pdfActionBtn}
                  onClick={() => window.open(viewModal.resume!.file_url, '_blank')}
                  title="Open in new tab"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 19H5V5h7V3H5C3.89 3 3 3.9 3 5v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                  </svg>
                  Open Tab
                </button>
                <button
                  className={`${resumeStyles.pdfActionBtn} ${resumeStyles.pdfActionBtnDanger}`}
                  onClick={() => {
                    setViewModal({ open: false, resume: null });
                    openDeleteConfirm(viewModal.resume!.id, viewModal.resume!.file_name);
                  }}
                  title="Delete resume"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                  Delete
                </button>
                <button
                  className={resumeStyles.pdfCloseBtn}
                  onClick={() => setViewModal({ open: false, resume: null })}
                  title="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            </div>
            {/* PDF iframe */}
            <div className={resumeStyles.pdfIframeWrapper}>
              <iframe
                src={viewModal.resume.file_url}
                title={viewModal.resume.file_name}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirm.open && (
        <div className={resumeStyles.modalOverlay} onClick={closeDeleteConfirm}>
          <div
            className={resumeStyles.confirmModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className={resumeStyles.modalIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 id="delete-modal-title" className={resumeStyles.modalTitle}>Delete Resume?</h3>
            <p className={resumeStyles.modalMessage}>
              Are you sure you want to delete{' '}
              <strong>"{deleteConfirm.fileName}"</strong>?<br />
              This action cannot be undone.
            </p>
            <div className={resumeStyles.modalActions}>
              <button className={resumeStyles.cancelBtn} onClick={closeDeleteConfirm}>
                Cancel
              </button>
              <button className={resumeStyles.deleteConfirmBtn} onClick={confirmDelete}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.dashboardContent}>
        {/* Page header */}
        <div className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle}>Your Resume</h1>
          <p className={styles.welcomeSubtitle}>
            View and manage your resumes for interview preparation
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className={resumeStyles.alertError}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {error}
            <button className={resumeStyles.alertClose} onClick={() => setError(null)}>×</button>
          </div>
        )}
        {successMsg && (
          <div className={resumeStyles.alertSuccess}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
            {successMsg}
          </div>
        )}

        {/* Main Card */}
        <div className={styles.section}>
          {/* Header row */}
          <div className={styles.sectionHeader}>
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z" />
              </svg>
              Resume Management
              {resumes.length > 0 && (
                <span className={resumeStyles.resumeCount}>{resumes.length}</span>
              )}
            </h3>
            <label
              className={`${styles.actionButton} ${resumeStyles.uploadLabel} ${isUploading ? resumeStyles.uploading : ''}`}
            >
              {isUploading ? (
                <><span className={resumeStyles.btnSpinner} />Uploading…</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>Upload Resume</>
              )}
              <input
                type="file"
                accept=".pdf"
                onChange={handleResumeUpload}
                style={{ display: 'none' }}
                disabled={isUploading}
              />
            </label>
          </div>

          {/* Resume list OR empty state */}
          {resumes.length === 0 ? (
            <div className={styles.activityList}>
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#94a3b8' }}>
                    <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z" />
                  </svg>
                </div>
                <p className={styles.emptyText}>No resume uploaded yet</p>
                <p className={styles.emptySubtext}>
                  Upload your resume to get started with AI-powered interview preparation
                </p>
                <label
                  className={`${styles.actionButton} ${resumeStyles.uploadLabel}`}
                  style={{ marginTop: '1.5rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isUploading ? (
                    <><span className={resumeStyles.btnSpinner} />Uploading…</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>Choose File</>
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleResumeUpload}
                    style={{ display: 'none' }}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className={resumeStyles.resumeList}>
              <p className={resumeStyles.resumesLabel}>
                Your Resumes ({resumes.length})
              </p>
              {resumes.map((resume, index) => {
                const isBeingDeleted = isDeleting === resume.id;
                return (
                  <div key={resume.id} className={resumeStyles.resumeCard}>
                    {/* Left info (clickable → open view modal) */}
                    <button
                      className={resumeStyles.resumeCardInfo}
                      onClick={() => setViewModal({ open: true, resume })}
                    >
                      <div className={resumeStyles.resumeCardIcon}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z" />
                        </svg>
                      </div>
                      <div className={resumeStyles.resumeCardText}>
                        <div className={resumeStyles.resumeFileName}>
                          {resume.file_name}
                          {index === 0 && (
                            <span className={resumeStyles.latestBadge}>Latest</span>
                          )}
                        </div>
                        <div className={resumeStyles.resumeMeta}>
                          {(getFileSize(resume) / 1024).toFixed(1)} KB &bull;{' '}
                          {new Date(resume.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </div>
                      </div>
                    </button>

                    {/* Action buttons */}
                    <div className={resumeStyles.resumeCardActions}>
                      {/* View PDF */}
                      <button
                        className={resumeStyles.iconBtn}
                        title="Preview resume"
                        onClick={() => setViewModal({ open: true, resume })}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>

                      {/* Open in new tab */}
                      <button
                        className={resumeStyles.iconBtn}
                        title="Open in new tab"
                        onClick={() => window.open(resume.file_url, '_blank')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 19H5V5h7V3H5C3.89 3 3 3.9 3 5v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        className={`${resumeStyles.iconBtn} ${resumeStyles.iconBtnDanger}`}
                        title="Delete resume"
                        disabled={isBeingDeleted}
                        onClick={() => openDeleteConfirm(resume.id, resume.file_name)}
                      >
                        {isBeingDeleted ? (
                          <span className={resumeStyles.btnSpinnerSmall} />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Resume;