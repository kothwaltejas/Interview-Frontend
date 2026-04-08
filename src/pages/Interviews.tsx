import React, { useEffect, useMemo, useState } from 'react';
import { ApiService, InterviewAnswer, InterviewSession, InterviewSessionDetail } from '../services/api';
import styles from './Dashboard.module.css';

const Interviews: React.FC = () => {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, InterviewSessionDetail>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [roleFilter, setRoleFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await ApiService.getInterviewSessions();
        if (isMounted) {
          setSessions(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load interviews');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  const sessionsById = useMemo(() => {
    return sessions.reduce((acc, session) => {
      acc[session.id] = session;
      return acc;
    }, {} as Record<string, InterviewSession>);
  }, [sessions]);

  const roleOptions = useMemo(() => {
    const uniqueRoles = new Set<string>();
    sessions.forEach((session) => {
      if (session.target_role) {
        uniqueRoles.add(session.target_role);
      }
    });
    return ['all', ...Array.from(uniqueRoles)];
  }, [sessions]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) {
      return '0m';
    }
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  const formatScore = (score: number | null) => {
    if (score === null || score === undefined) {
      return 'N/A';
    }
    return `${score.toFixed(1)}/10`;
  };

  const handleToggleSession = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionId);

    if (sessionDetails[sessionId] || detailLoading[sessionId]) {
      return;
    }

    setDetailLoading((prev) => ({ ...prev, [sessionId]: true }));

    const detail = await ApiService.getInterviewSessionDetail(sessionId);
    if (detail) {
      setSessionDetails((prev) => ({ ...prev, [sessionId]: detail }));
    }

    setDetailLoading((prev) => ({ ...prev, [sessionId]: false }));
  };

  const handleOpenDetail = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setExpandedSessionId(null);

    if (sessionDetails[sessionId] || detailLoading[sessionId]) {
      return;
    }

    setDetailLoading((prev) => ({ ...prev, [sessionId]: true }));

    const detail = await ApiService.getInterviewSessionDetail(sessionId);
    if (detail) {
      setSessionDetails((prev) => ({ ...prev, [sessionId]: detail }));
    }

    setDetailLoading((prev) => ({ ...prev, [sessionId]: false }));
  };

  const getFilteredSessions = () => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();

    return sessions.filter((session) => {
      if (roleFilter !== 'all' && session.target_role !== roleFilter) {
        return false;
      }

      if (term && !(session.target_role || '').toLowerCase().includes(term)) {
        return false;
      }

      if (dateFilter === 'all') {
        return true;
      }

      const completedAt = new Date(session.completed_at);
      if (Number.isNaN(completedAt.getTime())) {
        return false;
      }

      const diffDays = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (dateFilter === '7') return diffDays <= 7;
      if (dateFilter === '30') return diffDays <= 30;
      if (dateFilter === '90') return diffDays <= 90;
      return true;
    });
  };

  const filteredSessions = useMemo(getFilteredSessions, [sessions, roleFilter, dateFilter, searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage]);

  const renderScoreBreakdown = (scores: Record<string, number>) => {
    const entries = Object.entries(scores || {});
    if (entries.length === 0) {
      return null;
    }

    return (
      <div className={styles.scoreBreakdown}>
        {entries.map(([label, value]) => (
          <div key={label}>
            <span>{label.replace(/_/g, ' ')}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    );
  };

  const renderAnswerDetails = (answer: InterviewAnswer) => {
    const evaluation = answer.evaluation_summary || {};
    const strengths = Array.isArray(evaluation.strengths) ? evaluation.strengths : [];
    const weaknesses = Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses : [];
    const weakAreas = Array.isArray(evaluation.weak_areas) ? evaluation.weak_areas : [];
    const coachingTips = Array.isArray(evaluation.coaching_tips) ? evaluation.coaching_tips : [];
    const feedback = evaluation.feedback || evaluation.evaluation_summary || '';
    const averageScore = evaluation.average_score ?? answer.score;

    return (
      <div className={styles.answerItem}>
        <div className={styles.answerHeader}>
          <div>
            <span className={styles.answerNumber}>Q{answer.question_number}</span>
            <span className={styles.answerQuestion}>{answer.question_text || 'Question not available'}</span>
          </div>
          <span className={styles.answerScore}>
            {answer.is_skipped ? 'Skipped' : formatScore(typeof averageScore === 'number' ? averageScore : answer.score)}
          </span>
        </div>
        <div className={styles.answerMeta}>
          <span>{answer.category || 'General'}</span>
          <span>{answer.difficulty || 'medium'}</span>
          <span>{formatDuration(answer.duration_seconds)}</span>
        </div>
        {!answer.is_skipped && (
          <>
            <p className={styles.answerText}>{answer.answer_text || 'No answer recorded.'}</p>
            {feedback && <p className={styles.answerFeedback}>{feedback}</p>}
            {renderScoreBreakdown(evaluation.scores || {})}
            {(strengths.length > 0 || weaknesses.length > 0 || weakAreas.length > 0) && (
              <div className={styles.answerHighlights}>
                {strengths.length > 0 && (
                  <div>
                    <h5>Strengths</h5>
                    <ul>
                      {strengths.map((item: string, index: number) => (
                        <li key={`strength-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {weaknesses.length > 0 && (
                  <div>
                    <h5>Weaknesses</h5>
                    <ul>
                      {weaknesses.map((item: string, index: number) => (
                        <li key={`weakness-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {weakAreas.length > 0 && (
                  <div>
                    <h5>Improve</h5>
                    <ul>
                      {weakAreas.map((item: string, index: number) => (
                        <li key={`weak-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {coachingTips.length > 0 && (
              <div className={styles.answerTips}>
                <h5>Coaching Tips</h5>
                <ul>
                  {coachingTips.map((item: string, index: number) => (
                    <li key={`tip-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {evaluation.improved_answer && (
              <div className={styles.improvedAnswer}>
                <h5>Improved Answer</h5>
                <p>{evaluation.improved_answer}</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Your Interviews</h1>
        <p className={styles.welcomeSubtitle}>
          Manage and track all your interview sessions
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Interview History</h3>
        </div>

        <div className={styles.activityList}>
          {selectedSessionId && sessionsById[selectedSessionId] && (
            <div className={styles.detailPage}>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setSelectedSessionId(null)}
              >
                Back to history
              </button>

              <div className={styles.detailHeader}>
                <div>
                  <h3>{sessionsById[selectedSessionId].target_role || 'Interview session'}</h3>
                  <p>{formatDate(sessionsById[selectedSessionId].completed_at)}</p>
                </div>
                <div className={styles.detailStats}>
                  <div>
                    <span>Average Score</span>
                    <strong>{formatScore(sessionsById[selectedSessionId].average_score)}</strong>
                  </div>
                  <div>
                    <span>Duration</span>
                    <strong>{formatDuration(sessionsById[selectedSessionId].duration_seconds)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{sessionsById[selectedSessionId].performance_tier || 'completed'}</strong>
                  </div>
                </div>
              </div>

              {sessionsById[selectedSessionId].overall_feedback && (
                <div className={styles.overallFeedback}>
                  <h5>Overall Feedback</h5>
                  <p>{sessionsById[selectedSessionId].overall_feedback}</p>
                </div>
              )}

              {detailLoading[selectedSessionId] && (
                <p className={styles.detailLoading}>Loading evaluation history...</p>
              )}

              {!detailLoading[selectedSessionId] && sessionDetails[selectedSessionId]?.answers?.length ? (
                <div className={styles.answerList}>
                  {sessionDetails[selectedSessionId].answers.map(renderAnswerDetails)}
                </div>
              ) : null}

              {!detailLoading[selectedSessionId] && sessionDetails[selectedSessionId] && sessionDetails[selectedSessionId].answers.length === 0 && (
                <p className={styles.detailLoading}>No answers recorded for this session.</p>
              )}
            </div>
          )}

          {!selectedSessionId && (
            <>
              <div className={styles.filtersRow}>
                <div className={styles.filtersLeft}>
                  <div className={styles.filterField}>
                    <label htmlFor="roleFilter">Role</label>
                    <select
                      id="roleFilter"
                      value={roleFilter}
                      onChange={(event) => {
                        setRoleFilter(event.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role === 'all' ? 'All roles' : role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterField}>
                    <label htmlFor="dateFilter">Date</label>
                    <select
                      id="dateFilter"
                      value={dateFilter}
                      onChange={(event) => {
                        setDateFilter(event.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="all">All time</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                    </select>
                  </div>
                </div>
                <div className={styles.filtersRight}>
                  <div className={styles.searchField}>
                    <label htmlFor="searchInput">Search</label>
                    <input
                      id="searchInput"
                      type="text"
                      placeholder="Search role"
                      value={searchTerm}
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>

              {loading && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>⏳</div>
                  <p className={styles.emptyText}>Loading interviews</p>
                  <p className={styles.emptySubtext}>Fetching your interview history</p>
                </div>
              )}

              {!loading && error && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>⚠️</div>
                  <p className={styles.emptyText}>Unable to load interviews</p>
                  <p className={styles.emptySubtext}>{error}</p>
                </div>
              )}

              {!loading && !error && filteredSessions.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🎤</div>
                  <p className={styles.emptyText}>No interviews yet</p>
                  <p className={styles.emptySubtext}>Start your first interview to see your history here</p>
                </div>
              )}

              {!loading && !error && filteredSessions.length > 0 && (
                <>
                  <div className={styles.historyTable}>
                    <div className={styles.tableHeader}>
                      <span>Date</span>
                      <span>Role</span>
                      <span>Average Score</span>
                      <span>Duration</span>
                      <span>Answered</span>
                      <span>Status</span>
                      <span>Details</span>
                    </div>

                    {paginatedSessions.map((session) => {
                      const detail = sessionDetails[session.id];
                      const isExpanded = expandedSessionId === session.id;
                      const isLoadingDetail = detailLoading[session.id];

                      return (
                        <React.Fragment key={session.id}>
                          <div className={styles.tableRow}>
                            <span>{formatDate(session.completed_at)}</span>
                            <span>{session.target_role || 'Interview'}</span>
                            <span>{formatScore(session.average_score)}</span>
                            <span>{formatDuration(session.duration_seconds)}</span>
                            <span>
                              {session.answered_questions || 0}/{session.total_questions || 0}
                            </span>
                            <span className={styles.statusBadge}>{session.performance_tier || 'completed'}</span>
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => handleOpenDetail(session.id)}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                className={styles.linkButtonSecondary}
                                onClick={() => handleToggleSession(session.id)}
                              >
                                {isExpanded ? 'Hide' : 'Quick view'}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className={styles.tableDetailRow}>
                              <div className={styles.interviewDetail}>
                                <div className={styles.interviewDetailMeta}>
                                  <div>
                                    <strong>Questions</strong>
                                    <span>
                                      {session.answered_questions || 0}/{session.total_questions || 0} answered
                                    </span>
                                  </div>
                                  <div>
                                    <strong>Interview Type</strong>
                                    <span>{session.interview_type || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <strong>Level</strong>
                                    <span>{session.experience_level || 'N/A'}</span>
                                  </div>
                                </div>

                                {session.overall_feedback && (
                                  <div className={styles.overallFeedback}>
                                    <h5>Overall Feedback</h5>
                                    <p>{session.overall_feedback}</p>
                                  </div>
                                )}

                                {isLoadingDetail && (
                                  <p className={styles.detailLoading}>Loading evaluation history...</p>
                                )}

                                {!isLoadingDetail && detail?.answers?.length ? (
                                  <div className={styles.answerList}>
                                    {detail.answers.slice(0, 2).map(renderAnswerDetails)}
                                  </div>
                                ) : null}

                                {!isLoadingDetail && detail && detail.answers.length === 0 && (
                                  <p className={styles.detailLoading}>No answers recorded for this session.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className={styles.paginationRow}>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Interviews;