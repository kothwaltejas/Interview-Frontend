import React, { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';
import schedStyles from './Schedule.module.css';
import { supabase } from '../lib/supabase';

interface ScheduledInterview {
  id: string;
  title: string;
  scheduled_at: string;
  role: string;
  experience_level: string;
  notes?: string;
  created_at: string;
}

const ROLES = [
  'Backend Engineer', 'Frontend Engineer', 'Full Stack Engineer',
  'DSA', 'System Design', 'Database / SQL', 'DevOps', 'Machine Learning', 'QA / Testing',
];
const EXPERIENCE_LEVELS = ['Fresher', '1-3 years', '3-5 years', '5+ years'];

const Schedule: React.FC = () => {
  const [interviews, setInterviews] = useState<ScheduledInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    scheduled_at: '',
    role: '',
    experience_level: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(new Date());

  // Tick every minute so countdown stays fresh
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Load from localStorage (no backend table needed)
  const loadSchedule = () => {
    try {
      const raw = localStorage.getItem('interviewai_schedule');
      if (raw) setInterviews(JSON.parse(raw));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const saveSchedule = (list: ScheduledInterview[]) => {
    localStorage.setItem('interviewai_schedule', JSON.stringify(list));
    setInterviews(list);
  };

  useEffect(() => { loadSchedule(); }, []);

  const handleAdd = async () => {
    setFormError('');
    if (!form.title || !form.scheduled_at || !form.role || !form.experience_level) {
      setFormError('Please fill in all required fields.');
      return;
    }
    const scheduledDate = new Date(form.scheduled_at);
    if (scheduledDate <= new Date()) {
      setFormError('Please choose a future date and time.');
      return;
    }
    setSaving(true);
    try {
      await supabase.auth.getUser();
      const newItem: ScheduledInterview = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: form.title,
        scheduled_at: form.scheduled_at,
        role: form.role,
        experience_level: form.experience_level,
        notes: form.notes,
        created_at: new Date().toISOString(),
      };
      const updated = [...interviews, newItem].sort((a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
      saveSchedule(updated);
      setForm({ title: '', scheduled_at: '', role: '', experience_level: '', notes: '' });
      setShowForm(false);
    } catch (e) {
      setFormError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    const updated = interviews.filter(i => i.id !== id);
    saveSchedule(updated);
    setDeleteConfirm(null);
    setDeletingId(null);
  };

  const getCountdown = (scheduledAt: string) => {
    const diff = new Date(scheduledAt).getTime() - now.getTime();
    if (diff <= 0) return { label: 'Past', urgent: false, overdue: true };
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours < 1) return { label: `${mins}m`, urgent: true, overdue: false };
    if (hours < 24) return { label: `${hours}h ${mins}m`, urgent: hours < 3, overdue: false };
    const days = Math.floor(hours / 24);
    return { label: `${days}d ${hours % 24}h`, urgent: false, overdue: false };
  };

  const upcoming = interviews.filter(i => new Date(i.scheduled_at) > now);
  const past = interviews.filter(i => new Date(i.scheduled_at) <= now);

  // Minimum date for the datetime-local input (now + 5 min, formatted)
  const minDate = new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16);

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className={styles.welcomeTitle}>Schedule</h1>
            <p className={styles.welcomeSubtitle}>Plan and manage your upcoming interview sessions</p>
          </div>
          <button
            className={schedStyles.addBtn}
            onClick={() => { setShowForm(s => !s); setFormError(''); }}
          >
            {showForm ? '✕ Cancel' : '+ Schedule Interview'}
          </button>
        </div>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}><h3>📅 New Scheduled Interview</h3></div>
          <div className={schedStyles.formBody}>
            {formError && <div className={schedStyles.formError}>{formError}</div>}

            <div className={schedStyles.formGrid}>
              <div className={schedStyles.formField}>
                <label className={schedStyles.label}>Session Title <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  className={schedStyles.input}
                  placeholder="e.g. Backend Mock Interview"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className={schedStyles.formField}>
                <label className={schedStyles.label}>Scheduled Date & Time <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="datetime-local"
                  className={schedStyles.input}
                  min={minDate}
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                />
              </div>
              <div className={schedStyles.formField}>
                <label className={schedStyles.label}>Target Role <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  className={schedStyles.select}
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="">Select role…</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className={schedStyles.formField}>
                <label className={schedStyles.label}>Experience Level <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  className={schedStyles.select}
                  value={form.experience_level}
                  onChange={e => setForm(f => ({ ...f, experience_level: e.target.value }))}
                >
                  <option value="">Select level…</option>
                  {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className={`${schedStyles.formField} ${schedStyles.formFieldFull}`}>
                <label className={schedStyles.label}>Notes (optional)</label>
                <textarea
                  className={schedStyles.textarea}
                  placeholder="Topics to focus on, preparation notes…"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className={schedStyles.formActions}>
              <button className={schedStyles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={schedStyles.saveBtn} onClick={handleAdd} disabled={saving}>
                {saving ? <><span className={schedStyles.btnSpinner} />Saving…</> : '📅 Schedule Interview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upcoming ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" /></svg>
            Upcoming Sessions{upcoming.length > 0 && <span className={schedStyles.countBadge}>{upcoming.length}</span>}
          </h3>
        </div>

        {loading ? (
          <div className={schedStyles.skeletonList}>
            {[1, 2].map(i => <div key={i} className={schedStyles.skeleton} />)}
          </div>
        ) : upcoming.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" />
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" />
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <p className={styles.emptyText}>No upcoming interviews scheduled</p>
            <p className={styles.emptySubtext}>Click "Schedule Interview" to add your first session</p>
          </div>
        ) : (
          <div className={schedStyles.sessionList}>
            {upcoming.map(item => {
              const cd = getCountdown(item.scheduled_at);
              return (
                <div key={item.id} className={`${schedStyles.sessionCard} ${cd.urgent ? schedStyles.sessionCardUrgent : ''}`}>
                  <div className={schedStyles.sessionCardLeft}>
                    <div className={`${schedStyles.countdownBadge} ${cd.urgent ? schedStyles.countdownUrgent : ''}`}>
                      ⏰ {cd.label}
                    </div>
                    <div className={schedStyles.sessionTitle}>{item.title}</div>
                    <div className={schedStyles.sessionMeta}>
                      <span className={schedStyles.metaChip}>{item.role}</span>
                      <span className={schedStyles.metaChip}>{item.experience_level}</span>
                      <span className={schedStyles.metaDate}>
                        {new Date(item.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' at '}
                        {new Date(item.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    {item.notes && <div className={schedStyles.sessionNotes}>📝 {item.notes}</div>}
                  </div>
                  <button
                    className={schedStyles.deleteBtn}
                    onClick={() => setDeleteConfirm(item.id)}
                    title="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Past sessions ── */}
      {past.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}><h3>🗂 Past Sessions</h3></div>
          <div className={schedStyles.sessionList}>
            {past.slice().reverse().map(item => (
              <div key={item.id} className={`${schedStyles.sessionCard} ${schedStyles.sessionCardPast}`}>
                <div className={schedStyles.sessionCardLeft}>
                  <div className={schedStyles.countdownBadge} style={{ background: '#f1f5f9', color: '#94a3b8' }}>
                    ✓ Completed
                  </div>
                  <div className={schedStyles.sessionTitle} style={{ color: '#94a3b8' }}>{item.title}</div>
                  <div className={schedStyles.sessionMeta}>
                    <span className={schedStyles.metaChip}>{item.role}</span>
                    <span className={schedStyles.metaDate}>
                      {new Date(item.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <button
                  className={`${schedStyles.deleteBtn} ${schedStyles.deleteBtnMuted}`}
                  onClick={() => setDeleteConfirm(item.id)}
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteConfirm && (
        <div className={schedStyles.modalOverlay}>
          <div className={schedStyles.modal}>
            <div className={schedStyles.modalIcon}>🗑️</div>
            <h3 className={schedStyles.modalTitle}>Delete Session?</h3>
            <p className={schedStyles.modalSub}>This scheduled interview will be permanently removed.</p>
            <div className={schedStyles.modalActions}>
              <button className={schedStyles.cancelBtn} onClick={() => setDeleteConfirm(null)}>Keep it</button>
              <button className={schedStyles.deleteConfirmBtn} onClick={() => handleDelete(deleteConfirm)}>
                {deletingId === deleteConfirm ? <span className={schedStyles.btnSpinner} /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;