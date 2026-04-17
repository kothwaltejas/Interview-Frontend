import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from './Dashboard.module.css';
import iStyles from './Interviews.module.css';

// ─── Types ───────────────────────────────────────────────────────────
interface InterviewSession {
  id: string;
  target_role: string;
  experience_level: string;
  interview_type: string;
  mode: string;
  total_questions: number;
  answered_questions: number;
  skipped_questions: number;
  duration_seconds: number;
  average_score: number | null;
  performance_tier: string | null;
  overall_feedback: string | null;
  topics_covered: string[];
  completed_at: string;
  status: string;
}

interface Answer {
  id: string;
  question_number: number;
  question_text: string;
  category: string;
  difficulty: string;
  answer_text: string;
  is_skipped: boolean;
  score: number | null;
  evaluation_summary: string | null;
}

// ─── Row skeleton ─────────────────────────────────────────────────────
const RowSkeleton: React.FC = () => (
  <>
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className={iStyles.skeletonRow}>
        <div className={iStyles.skeletonCell} style={{ width: '90px' }} />
        <div className={iStyles.skeletonCell} style={{ width: '140px' }} />
        <div className={iStyles.skeletonCell} style={{ width: '80px' }} />
        <div className={iStyles.skeletonCell} style={{ width: '70px' }} />
        <div className={iStyles.skeletonCell} style={{ width: '60px' }} />
        <div className={iStyles.skeletonCell} style={{ width: '80px' }} />
      </div>
    ))}
  </>
);

// ─── Helpers ─────────────────────────────────────────────────────────
const formatDuration = (seconds: number) => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

const tierColor = (tier: string | null) => {
  switch (tier) {
    case 'excellent': return iStyles.tierExcellent;
    case 'good': return iStyles.tierGood;
    case 'average': return iStyles.tierAverage;
    default: return iStyles.tierNeeds;
  }
};

const scoreColor = (score: number | null) => {
  if (score === null || score === undefined) return '#94a3b8';
  if (score >= 8) return '#059669';
  if (score >= 6) return '#d97706';
  return '#dc2626';
};

const PAGE_SIZE = 8;

// ─── Component ───────────────────────────────────────────────────────
const Interviews: React.FC = () => {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [filtered, setFiltered] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  // Detail Modal
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    session: InterviewSession | null;
    answers: Answer[];
    loadingAnswers: boolean;
  }>({ open: false, session: null, answers: [], loadingAnswers: false });

  // ─ fetch all sessions ─
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('http://localhost:8000/api/db/sessions?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load interviews');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load interviews');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchSessions();
  }, [user, fetchSessions]);

  // ─ filter & sort ─
  useEffect(() => {
    let result = [...sessions];

    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(
        s =>
          s.target_role?.toLowerCase().includes(q) ||
          s.interview_type?.toLowerCase().includes(q)
      );
    }
    if (roleFilter) result = result.filter(s => s.target_role === roleFilter);
    if (typeFilter) result = result.filter(s => s.interview_type === typeFilter);
    if (tierFilter) result = result.filter(s => s.performance_tier === tierFilter);

    setFiltered(result);
    setPage(1);
  }, [sessions, searchText, roleFilter, typeFilter, tierFilter]);

  // ─ open detail modal ─
  const openDetail = async (session: InterviewSession) => {
    setDetailModal({ open: true, session, answers: [], loadingAnswers: true });
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`http://localhost:8000/api/db/sessions/${session.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load session');
      const data = await res.json();
      setDetailModal(prev => ({
        ...prev,
        answers: data.answers || [],
        loadingAnswers: false,
      }));
    } catch {
      setDetailModal(prev => ({ ...prev, loadingAnswers: false }));
    }
  };

  const closeDetail = () =>
    setDetailModal({ open: false, session: null, answers: [], loadingAnswers: false });

  // ─ ESC to close ─
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // ─ pagination slice ─
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─ unique values for filters ─
  const uniqueRoles = [...new Set(sessions.map(s => s.target_role).filter(Boolean))].sort();
  const uniqueTypes = [...new Set(sessions.map(s => s.interview_type).filter(Boolean))].sort();

  const clearFilters = () => {
    setRoleFilter('');
    setTypeFilter('');
    setTierFilter('');
    setSearchText('');
  };
  const hasFilters = roleFilter || typeFilter || tierFilter || searchText;

  // ─── Inline loading skeleton ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className={styles.dashboardContent}>
        <div className={styles.welcomeSection}>
          <div className={iStyles.headerSkeletonBar} style={{ width: '220px', height: '2rem' }} />
          <div className={iStyles.headerSkeletonBar} style={{ width: '340px', height: '1rem', marginTop: '.5rem' }} />
        </div>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={iStyles.headerSkeletonBar} style={{ width: '160px', height: '1.1rem' }} />
          </div>
          <div className={iStyles.tableWrapper}>
            <RowSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ─── Session Detail Modal ─── */}
      {detailModal.open && detailModal.session && (
        <div className={iStyles.modalOverlay} onClick={closeDetail}>
          <div
            className={iStyles.detailModal}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal header */}
            <div className={iStyles.detailHeader}>
              <div>
                <h3 className={iStyles.detailTitle}>
                  {detailModal.session.target_role || 'Interview'} Session
                </h3>
                <p className={iStyles.detailSubtitle}>
                  {formatDate(detailModal.session.completed_at)} &bull;{' '}
                  {detailModal.session.interview_type} &bull;{' '}
                  {formatDuration(detailModal.session.duration_seconds)}
                </p>
              </div>
              <button className={iStyles.closeBtn} onClick={closeDetail} title="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>

            {/* Score summary */}
            <div className={iStyles.scoreSummary}>
              <div className={iStyles.scoreBox}>
                <span className={iStyles.scoreValue} style={{ color: scoreColor(detailModal.session.average_score) }}>
                  {detailModal.session.average_score != null
                    ? detailModal.session.average_score.toFixed(1)
                    : '—'}
                </span>
                <span className={iStyles.scoreLabel}>Avg Score</span>
              </div>
              <div className={iStyles.scoreBox}>
                <span className={iStyles.scoreValue} style={{ color: '#2563EB' }}>
                  {detailModal.session.answered_questions}/{detailModal.session.total_questions}
                </span>
                <span className={iStyles.scoreLabel}>Answered</span>
              </div>
              <div className={iStyles.scoreBox}>
                <span className={iStyles.scoreValue} style={{ color: '#64748b' }}>
                  {detailModal.session.skipped_questions}
                </span>
                <span className={iStyles.scoreLabel}>Skipped</span>
              </div>
              {detailModal.session.performance_tier && (
                <div className={iStyles.scoreBox}>
                  <span className={`${iStyles.tierBadge} ${tierColor(detailModal.session.performance_tier)}`}>
                    {detailModal.session.performance_tier}
                  </span>
                  <span className={iStyles.scoreLabel}>Tier</span>
                </div>
              )}
            </div>

            {/* Feedback */}
            {detailModal.session.overall_feedback && (
              <div className={iStyles.feedbackBox}>
                <p className={iStyles.feedbackLabel}>Overall Feedback</p>
                <p className={iStyles.feedbackText}>{detailModal.session.overall_feedback}</p>
              </div>
            )}

            {/* Answers */}
            <div className={iStyles.answersSection}>
              <p className={iStyles.answersHeading}>Questions & Answers</p>
              {detailModal.loadingAnswers ? (
                <div className={iStyles.answersLoading}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className={iStyles.answerSkeletonCard}>
                      <div className={iStyles.headerSkeletonBar} style={{ width: '90%', height: '.9rem' }} />
                      <div className={iStyles.headerSkeletonBar} style={{ width: '70%', height: '.75rem', marginTop: '.5rem' }} />
                    </div>
                  ))}
                </div>
              ) : detailModal.answers.length === 0 ? (
                <p className={iStyles.noAnswers}>No answer details available.</p>
              ) : (
                <div className={iStyles.answersList}>
                  {detailModal.answers.map(ans => (
                    <div key={ans.id} className={`${iStyles.answerCard} ${ans.is_skipped ? iStyles.answerSkipped : ''}`}>
                      <div className={iStyles.answerTop}>
                        <span className={iStyles.answerNum}>Q{ans.question_number}</span>
                        <span className={iStyles.answerCategory}>{ans.category}</span>
                        <span className={iStyles.answerDiff}>{ans.difficulty}</span>
                        {ans.score != null && (
                          <span className={iStyles.answerScore} style={{ color: scoreColor(ans.score) }}>
                            {ans.score.toFixed(1)}/10
                          </span>
                        )}
                        {ans.is_skipped && <span className={iStyles.skippedBadge}>Skipped</span>}
                      </div>
                      <p className={iStyles.questionText}>{ans.question_text}</p>
                      {!ans.is_skipped && ans.answer_text && (
                        <p className={iStyles.answerText}>{ans.answer_text}</p>
                      )}
                      {ans.evaluation_summary && !ans.is_skipped && (
                        <p className={iStyles.evalSummary}>{
                          typeof ans.evaluation_summary === 'string'
                            ? ans.evaluation_summary
                            : JSON.stringify(ans.evaluation_summary)
                        }</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div className={styles.dashboardContent}>
        <div className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle}>My Interviews</h1>
          <p className={styles.welcomeSubtitle}>
            Your complete interview history — track progress and review answers
          </p>
        </div>

        {error && (
          <div className={iStyles.errorBanner}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {error}
            <button onClick={fetchSessions} className={iStyles.retryBtn}>Retry</button>
          </div>
        )}

        <div className={styles.section}>
          {/* ── Filters bar ── */}
          <div className={iStyles.filtersBar}>
            {/* Search */}
            <div className={iStyles.searchWrapper}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iStyles.searchIcon}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className={iStyles.searchInput}
                placeholder="Search role or type…"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>

            {/* Role filter */}
            <select
              className={iStyles.filterSelect}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* Type filter */}
            <select
              className={iStyles.filterSelect}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Tier filter */}
            <select
              className={iStyles.filterSelect}
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
            >
              <option value="">All Tiers</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="average">Average</option>
              <option value="needs_improvement">Needs Improvement</option>
            </select>

            {hasFilters && (
              <button className={iStyles.clearBtn} onClick={clearFilters}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
                Clear
              </button>
            )}

            <span className={iStyles.resultCount}>
              {filtered.length} interview{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* ── Table ── */}
          {sessions.length === 0 ? (
            <div className={styles.activityList}>
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🎤</div>
                <p className={styles.emptyText}>No interviews completed yet</p>
                <p className={styles.emptySubtext}>
                  Complete your first AI interview session to see your history here
                </p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.activityList}>
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔍</div>
                <p className={styles.emptyText}>No results found</p>
                <p className={styles.emptySubtext}>Try adjusting your filters</p>
                <button className={iStyles.clearBtn} style={{ marginTop: '1rem' }} onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className={iStyles.tableWrapper}>
                <table className={iStyles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Role</th>
                      <th>Type</th>
                      <th>Score</th>
                      <th>Duration</th>
                      <th>Tier</th>
                      <th>Answered</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(s => (
                      <tr key={s.id} className={iStyles.tableRow} onClick={() => openDetail(s)}>
                        <td className={iStyles.dateCell}>{formatDate(s.completed_at)}</td>
                        <td>
                          <span className={iStyles.rolePill}>{s.target_role || '—'}</span>
                        </td>
                        <td>
                          <span className={iStyles.typePill}>{s.interview_type || '—'}</span>
                        </td>
                        <td>
                          <span
                            className={iStyles.scoreCell}
                            style={{ color: scoreColor(s.average_score) }}
                          >
                            {s.average_score != null ? s.average_score.toFixed(1) : '—'}
                            {s.average_score != null && <small>/10</small>}
                          </span>
                        </td>
                        <td className={iStyles.durationCell}>
                          {formatDuration(s.duration_seconds)}
                        </td>
                        <td>
                          {s.performance_tier ? (
                            <span className={`${iStyles.tierBadge} ${tierColor(s.performance_tier)}`}>
                              {s.performance_tier.replace('_', ' ')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className={iStyles.answeredCell}>
                          {s.answered_questions}/{s.total_questions}
                        </td>
                        <td>
                          <button
                            className={iStyles.viewBtn}
                            onClick={e => { e.stopPropagation(); openDetail(s); }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className={iStyles.mobileCards}>
                {paginated.map(s => (
                  <div
                    key={s.id}
                    className={iStyles.mobileCard}
                    onClick={() => openDetail(s)}
                  >
                    <div className={iStyles.mobileCardTop}>
                      <div>
                        <span className={iStyles.rolePill}>{s.target_role || 'Interview'}</span>
                        <span className={iStyles.typePill} style={{ marginLeft: '.5rem' }}>
                          {s.interview_type}
                        </span>
                      </div>
                      <span
                        className={iStyles.scoreCell}
                        style={{ color: scoreColor(s.average_score) }}
                      >
                        {s.average_score != null ? `${s.average_score.toFixed(1)}/10` : '—'}
                      </span>
                    </div>
                    <div className={iStyles.mobileCardBot}>
                      <span>{formatDate(s.completed_at)}</span>
                      {s.performance_tier && (
                        <span className={`${iStyles.tierBadge} ${tierColor(s.performance_tier)}`}>
                          {s.performance_tier.replace('_', ' ')}
                        </span>
                      )}
                      <span>{s.answered_questions}/{s.total_questions} answered</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className={iStyles.pagination}>
                  <button
                    className={iStyles.pageBtn}
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <div className={iStyles.pageNumbers}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(n =>
                        n === 1 || n === totalPages ||
                        Math.abs(n - page) <= 1
                      )
                      .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                        if (idx > 0 && typeof arr[idx - 1] === 'number' && (n as number) - (arr[idx - 1] as number) > 1) {
                          acc.push('...');
                        }
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === '...'
                          ? <span key={`dots-${idx}`} className={iStyles.pageDots}>…</span>
                          : <button
                              key={item}
                              className={`${iStyles.pageNum} ${page === item ? iStyles.pageNumActive : ''}`}
                              onClick={() => setPage(item as number)}
                            >
                              {item}
                            </button>
                      )}
                  </div>
                  <button
                    className={iStyles.pageBtn}
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next →
                  </button>
                  <span className={iStyles.pageInfo}>
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Interviews;