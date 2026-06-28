import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Dashboard.module.css';
import labStyles from './PracticeTests.module.css';
import { authService, supabase } from '../lib/supabase';
import VoiceInterview from '../components/VoiceInterview';
import EvaluationBreakdown from '../components/EvaluationBreakdown';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Types ─────────────────────────────────────────────────────────────────
interface ParsedResumeData {
  name: string; email: string; phone: string;
  skills: string[]; experience: any[]; projects: any[]; education: any[];
}
interface JobContext { target_role: string; experience_level: string; interview_type: string; }
interface InterviewQuestion {
  id: number; question: string; category: string; difficulty: string;
  focus_area: string; expected_duration_seconds: number;
  question_number?: number; total_questions?: number;
}
interface SessionState {
  session_id: string;
  current_question: InterviewQuestion | null;
  progress: { current: number; total: number };
}
interface Evaluation {
  average_score: number;
  feedback: string;
  strengths?: string[];
  weaknesses?: string[];
  weak_areas?: string[];
  score_confidence?: 'high' | 'medium' | 'low';
  difficulty?: string;
  metadata?: {
    fallback?: boolean;
    dataset_match?: boolean;
    strong_match?: boolean;
    similarity_score?: number;
  };
  scores?: {
    technical_accuracy?: number;
    clarity?: number;
    communication?: number;
    completeness?: number;
  };
}
interface ConversationMessage { role: 'interviewer' | 'candidate'; message: string; timestamp: Date; }
interface InterviewAnswer {
  questionId: number; questionNumber: number; questionText: string;
  category: string; difficulty: string; answerText: string;
  isSkipped: boolean; timestamp: Date; timeTakenSeconds?: number;
}
interface SavedResume {
  id: string; file_name: string; file_url: string;
  file_size_bytes?: number; file_size?: number; created_at: string;
}

type ViewMode = 'select-resume' | 'job-context' | 'interview' | 'summary';

// ─── Fixed role list ────────────────────────────────────────────────────────
const ROLES = [
  'Backend Engineer', 'Frontend Engineer', 'Full Stack Engineer',
  'DSA', 'System Design', 'Database / SQL', 'DevOps', 'Machine Learning', 'QA / Testing',
];
const EXPERIENCE_LEVELS = [
  { value: 'Fresher', label: 'Fresher (0–1 yr)' },
  { value: '1-3 years', label: 'Junior (1–3 yrs)' },
  { value: '3-5 years', label: 'Mid-level (3–5 yrs)' },
  { value: '5+ years', label: 'Senior (5+ yrs)' },
];
const ROLE_ICONS: Record<string, string> = {
  'Backend Engineer': 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 12H4v-2h11v2zm3-4H4v-2h14v2zm0-4H4V6h14v2z',
  'Frontend Engineer': 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  'Full Stack Engineer': 'M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5S15.01 22 17.5 22s4.5-2.01 4.5-4.5S19.99 13 17.5 13zm0 7c-1.38 0-2.5-1.12-2.5-2.5S16.12 15 17.5 15s2.5 1.12 2.5 2.5S18.88 20 17.5 20zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z',
  'DSA': 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  'System Design': 'M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3zm0 12.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  'Database / SQL': 'M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.59 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm6 14c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-4.5c0 .5-2.13 2-6 2s-6-1.5-6-2V10.27c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V12.5zm-6-3C8.13 9.5 6 8 6 7s2.13-2.5 6-2.5S18 6 18 7s-2.13 2.5-6 2.5z',
  'DevOps': 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-2.5H9.5v-2H12V9l3.5 2.75L12 14.5z',
  'Machine Learning': 'M21 11.5v-1l-3-3V5c0-.55-.45-1-1-1h-2c-.55 0-1 .45-1 1v.17L9 0 3 6l1.5 1.5 1-1V8c0 .55.45 1 1 1h2v.17l-3 3V11.5L3 14l1.41 1.41L6 13.81V17h12v-3.19l1.59 1.6L21 14l-2.5-2.5zm-9 3.5H7v-4.83l5-5 5 5V15h-5z',
  'QA / Testing': 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z',
};

const INTERVIEW_TYPES = [
  { value: 'Technical', label: 'Technical', desc: 'Data structures, algorithms, coding', icon: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z', color: '#3b82f6' },
  { value: 'HR', label: 'HR / Behavioral', desc: 'Soft skills, culture fit, behavior', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', color: '#10b981' },
  { value: 'Mixed', label: 'Mixed (Tech + HR)', desc: 'Combination of both formats', icon: 'M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5S15.01 22 17.5 22s4.5-2.01 4.5-4.5S19.99 13 17.5 13zm0 7c-1.38 0-2.5-1.12-2.5-2.5S16.12 15 17.5 15s2.5 1.12 2.5 2.5S18.88 20 17.5 20zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z', color: '#8b5cf6' },
];

// ─── Component ──────────────────────────────────────────────────────────────
const PracticeTestsMain: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('select-resume');

  // Resume selection
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Interview state
  const [parsedData, setParsedData] = useState<ParsedResumeData | null>(null);
  const [jobContext, setJobContext] = useState<JobContext>({ target_role: '', experience_level: '', interview_type: '' });
  const [session, setSession] = useState<SessionState | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_currentAnswer, setCurrentAnswer] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_evaluation, _setEvaluation] = useState<Evaluation | null>(null);
  const [interviewAnswers, setInterviewAnswers] = useState<InterviewAnswer[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [answerEvaluations, setAnswerEvaluations] = useState<Map<number, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showingResponse, setShowingResponse] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<any | null>(null);
  const [pendingNextQuestion, setPendingNextQuestion] = useState<{
    nextQuestion: any;
    progress: any;
    msg: string;
  } | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  // STT / auth
  const [sttAvailable, setSttAvailable] = useState<boolean | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_authToken, setAuthToken] = useState<string | null>(null);

  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversationHistory]);

  // Fetch saved resumes
  const fetchSavedResumes = useCallback(async () => {
    setLoadingResumes(true);
    try {
      const token = await authService.getValidAccessToken();
      const res = await fetch(`${API_BASE_URL}/api/db/resumes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSavedResumes(data.resumes || []);
        if (data.resumes?.length > 0) setSelectedResumeId(data.resumes[0].id);
      }
    } catch { /* offline */ }
    finally { setLoadingResumes(false); }
  }, []);

  useEffect(() => { fetchSavedResumes(); }, [fetchSavedResumes]);

  // STT check
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/audio/stt/status`);
        const r = await res.json();
        setSttAvailable(r.available);
      } catch { setSttAvailable(false); }
    })();
  }, []);

  const getAuthToken = async () => {
    const token = await authService.getValidAccessToken().catch(() => null);
    setAuthToken(token);
    return token;
  };

  const recordAnswer = (answerText: string, isSkipped = false) => {
    if (!session?.current_question) return;
    const q = session.current_question;
    setInterviewAnswers(prev => {
      if (prev.some(a => a.questionId === q.id)) return prev;
      return [...prev, {
        questionId: q.id, questionNumber: session.progress.current,
        questionText: q.question, category: q.category, difficulty: q.difficulty,
        answerText, isSkipped, timestamp: new Date(),
      }];
    });
  };

  const handleAnswerSubmission = async (answerText: string, videoEngagement?: number, voiceMetrics?: any, cameraMetrics?: any) => {
    if (!session) return;
    setIsLoading(true);
    setShowingResponse(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/session/conversational-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          answer_text: answerText,
          time_taken_seconds: 0,
          video_engagement: videoEngagement !== undefined ? videoEngagement : 1.0,
          voice_metrics: voiceMetrics || null,
          camera_metrics: cameraMetrics || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        if (result.evaluation) {
          setAnswerEvaluations(prev => new Map(prev).set(session.progress.current - 1, result.evaluation));
        }
        if (result.is_complete) {
          if (result.evaluation) {
            setCurrentEvaluation(result.evaluation);
          }
          setConversationHistory(prev => [...prev, { role: 'interviewer', message: result.interviewer_response, timestamp: new Date() }]);

          setTimeout(async () => {
            setCurrentEvaluation(null);
            setPendingNextQuestion(null);
            setViewMode('summary');
            try {
              const token = await getAuthToken();
              const headers: HeadersInit = { 'Content-Type': 'application/json' };
              if (token) headers['Authorization'] = `Bearer ${token}`;
              await fetch(`${API_BASE_URL}/api/session/${session.session_id}/summary`, { method: 'GET', headers });
            } catch { /* ignore */ }
          }, 3000);
        } else {
          const nextQ = result.next_question?.question || 'Next question coming up...';
          const msg = `${result.interviewer_response}\n\n${nextQ}`;

          setTimeout(() => {
            try {
              setConversationHistory(prev => [...prev, { role: 'interviewer', message: msg, timestamp: new Date() }]);
              setSession(prev => prev ? {
                ...prev,
                current_question: result.next_question,
                progress: result.progress
              } : prev);
              setCurrentEvaluation(null);
              setShowingResponse(false);
              setPendingNextQuestion(null);
            } catch (err) {
              console.error('Failed to advance to next question:', err);
              setPendingNextQuestion({
                nextQuestion: result.next_question,
                progress: result.progress,
                msg
              });
            }
          }, 1500);
        }
      } else {
        console.error('Answer submission returned success=false:', result);
        const currentQ = session.current_question?.question || 'Could you try that again?';
        setTimeout(() => {
          setConversationHistory(prev => [...prev, {
            role: 'interviewer',
            message: `Let me repeat the question.\n\n${currentQ}`,
            timestamp: new Date()
          }]);
          setShowingResponse(false);
        }, 1000);
      }
    } catch (err) {
      console.error('Answer submission error:', err);
      const currentQ = session?.current_question?.question || 'Could you try that again?';
      setTimeout(() => {
        setConversationHistory(prev => [...prev, {
          role: 'interviewer',
          message: `Let me repeat the question.\n\n${currentQ}`,
          timestamp: new Date()
        }]);
        setShowingResponse(false);
      }, 1000);
    }
    finally { setIsLoading(false); }
  };

  const handleNextQuestion = async () => {
    if (!session) return;
    if (pendingNextQuestion && pendingNextQuestion.nextQuestion === null) {
      setViewMode('summary');
      setCurrentEvaluation(null);
      setPendingNextQuestion(null);
      try {
        const token = await getAuthToken();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`${API_BASE_URL}/api/session/${session.session_id}/summary`, { method: 'GET', headers });
      } catch { /* ignore */ }
    } else if (pendingNextQuestion) {
      setConversationHistory(prev => [...prev, { role: 'interviewer', message: pendingNextQuestion.msg, timestamp: new Date() }]);
      setSession({
        ...session,
        current_question: pendingNextQuestion.nextQuestion,
        progress: pendingNextQuestion.progress
      });
      setPendingNextQuestion(null);
      setCurrentEvaluation(null);
      setShowingResponse(false);
    }
  };

  const handleVoiceAnswerSubmit = async (answerText: string, videoEngagement: number, voiceMetrics?: any, cameraMetrics?: any) => {
    if (!session) return;
    recordAnswer(answerText, false);
    setConversationHistory(prev => [...prev, { role: 'candidate', message: answerText, timestamp: new Date() }]);
    await handleAnswerSubmission(answerText, videoEngagement, voiceMetrics, cameraMetrics);
  };

  const handleVoiceSkip = async () => { await handleSkipQuestion(); };

  const handleEndInterviewEarly = async () => {
    if (!session) return;
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${API_BASE_URL}/api/session/${session.session_id}/summary`, { method: 'GET', headers });
    } catch { /* ignore */ }
    setViewMode('summary');
  };

  const handleSkipQuestion = async () => {
    if (!session) return;
    recordAnswer('', true);
    setCurrentEvaluation(null);
    setPendingNextQuestion(null);
    setConversationHistory(prev => [...prev, { role: 'candidate', message: '[Question skipped]', timestamp: new Date() }]);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/session/skip`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.session_id }),
      });
      const result = await res.json();
      if (result.success) {
        const nextQ = result.result?.next_question;
        if (!nextQ || result.result?.status === 'completed') {
          try {
            const token = await getAuthToken();
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            await fetch(`${API_BASE_URL}/api/session/${session.session_id}/summary`, { method: 'GET', headers });
          } catch { /* ignore */ }
          setTimeout(() => setViewMode('summary'), 1000);
        } else {
          const nextQText = nextQ?.question || 'Next question coming up...';
          const msg = `No problem. Let's move on.\n\n${nextQText}`;
          setTimeout(() => {
            setConversationHistory(prev => [...prev, { role: 'interviewer', message: msg, timestamp: new Date() }]);
            setSession({
              ...session, current_question: nextQ,
              progress: { current: nextQ.question_number || (session.progress.current + 1), total: nextQ.total_questions || session.progress.total },
            });
            setCurrentAnswer('');
          }, 800);
        }
      }
    } catch { setError('Failed to skip question'); }
    finally { setIsLoading(false); }
  };

  // Proceed from resume → job context (silent parsing)
  const handleProceedToJobContext = async () => {
    setError('');
    if (!selectedResumeId && !selectedFile) {
      setError('Please select a resume or upload a new one.');
      return;
    }
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (selectedResumeId) {
        const resumeRes = await fetch(`${API_BASE_URL}/api/db/resumes`, { headers: { ...headers } });
        const resumeData = await resumeRes.json();
        const fullResume = resumeData.resumes?.find((r: any) => r.id === selectedResumeId);
        if (fullResume?.parsed_json && Object.keys(fullResume.parsed_json).length > 0) {
          setParsedData(fullResume.parsed_json);
        } else {
          setParsedData({
            name: fullResume?.file_name?.replace('.pdf', '') || 'Candidate',
            email: '', phone: '', skills: [], experience: [], projects: [], education: [],
          });
        }
      } else if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await fetch(`${API_BASE_URL}/api/resume/parse`, { method: 'POST', headers, body: formData });
        const result = await res.json();
        if (result.success) {
          setParsedData(result.data);
        } else {
          setError(result.error || 'Could not read resume.');
          setIsLoading(false);
          return;
        }
      }
      setViewMode('job-context');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start interview
  const handleStartInterview = async () => {
    if (!parsedData || !jobContext.target_role || !jobContext.experience_level || !jobContext.interview_type) {
      setError('Please fill in all fields to continue.');
      return;
    }
    setIsStarting(true);
    setError('');
    try {
      const token = await getAuthToken();
      const authHeader: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeader['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/session/create-conversational`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          user_id: (await supabase.auth.getUser()).data.user?.id || 'anon',
          resume_data: parsedData,
          job_context: jobContext,
          num_questions: 10,
        }),
      });
      const result = await res.json();
      if (result.success) {
        const openingQ = result.opening_question || result.current_question;
        setSession({ session_id: result.session_id, current_question: openingQ, progress: { current: 1, total: result.total_questions } });
        setInterviewAnswers([]);
        setAnswerEvaluations(new Map());
        setCurrentEvaluation(null);
        setPendingNextQuestion(null);
        setConversationHistory([{ role: 'interviewer', message: openingQ.question, timestamp: new Date() }]);
        setViewMode('interview');
      } else {
        setError('Failed to start interview. Please try again.');
      }
    } catch {
      setError('Failed to start interview.');
    } finally {
      setIsStarting(false);
    }
  };

  const resetAll = () => {
    setViewMode('select-resume');
    setSession(null);
    setParsedData(null);
    setSelectedFile(null);
    setSelectedResumeId(savedResumes[0]?.id || null);
    setInterviewAnswers([]);
    setAnswerEvaluations(new Map());
    setConversationHistory([]);
    setShowingResponse(false);
    setJobContext({ target_role: '', experience_level: '', interview_type: '' });
    setError('');
    setCurrentEvaluation(null);
    setPendingNextQuestion(null);
  };

  const steps = ['Select Resume', 'Interview Setup', 'AI Interview', 'Summary'];
  const stepIndex: Record<ViewMode, number> = { 'select-resume': 0, 'job-context': 1, 'interview': 2, 'summary': 3 };
  const currentStep = stepIndex[viewMode];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.dashboardContent}>
      {/* Page header */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>Interview Lab</h1>
        <p className={styles.welcomeSubtitle}>Practice with an AI interviewer and get real-time feedback</p>
      </div>

      {/* Step progress bar */}
      <div className={labStyles.stepBar}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`${labStyles.step} ${i < currentStep ? labStyles.stepDone : ''} ${i === currentStep ? labStyles.stepActive : ''}`}>
              <div className={labStyles.stepCircle}>
                {i < currentStep ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className={labStyles.stepLabel}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`${labStyles.stepLine} ${i < currentStep ? labStyles.stepLineDone : ''}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className={labStyles.errorBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
          {error}
          <button onClick={() => setError('')} className={labStyles.errorClose}>×</button>
        </div>
      )}

      {/* ─── STEP 1: Select Resume ─────────────────────────────────────────── */}
      {viewMode === 'select-resume' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" /></svg>
              Choose Your Resume
            </h3>
          </div>

          <div className={labStyles.resumeSelectBody}>
            {loadingResumes ? (
              <div className={labStyles.resumeSkeletons}>
                {[1, 2].map(i => <div key={i} className={labStyles.resumeSkeleton} />)}
              </div>
            ) : savedResumes.length > 0 ? (
              <>
                <p className={labStyles.resumeSelectHint}>Select a saved resume or upload a new one</p>
                <div className={labStyles.resumeGrid}>
                  {savedResumes.map((r, idx) => (
                    <button
                      key={r.id}
                      className={`${labStyles.resumeCard} ${selectedResumeId === r.id ? labStyles.resumeCardSelected : ''}`}
                      onClick={() => { setSelectedResumeId(r.id); setSelectedFile(null); }}
                    >
                      <div className={labStyles.resumeCardIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" /></svg>
                      </div>
                      <div className={labStyles.resumeCardInfo}>
                        <div className={labStyles.resumeCardName}>
                          {r.file_name}
                          {idx === 0 && <span className={labStyles.latestTag}>Latest</span>}
                        </div>
                        <div className={labStyles.resumeCardMeta}>
                          {((r.file_size_bytes ?? r.file_size ?? 0) / 1024).toFixed(1)} KB ·{' '}
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      {selectedResumeId === r.id && (
                        <div className={labStyles.resumeCheckmark}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className={labStyles.resumeSelectHint}>No saved resumes. Upload one below.</p>
            )}

            {/* Upload new */}
            <div className={labStyles.uploadZone}>
              <label
                className={`${labStyles.uploadCard} ${selectedFile ? labStyles.uploadCardSelected : ''}`}
                onClick={() => setSelectedResumeId(null)}
              >
                <div className={labStyles.uploadIcon}>
                  {selectedFile ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="#2563EB"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="#94a3b8"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" /></svg>
                  )}
                </div>
                <div className={labStyles.uploadText}>
                  {selectedFile ? (
                    <><strong>{selectedFile.name}</strong><span>Click to change</span></>
                  ) : (
                    <><strong>Upload a new resume</strong><span>PDF · max 10 MB</span></>
                  )}
                </div>
                <input
                  type="file" accept=".pdf" style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f?.type === 'application/pdf') { setSelectedFile(f); setSelectedResumeId(null); setError(''); }
                    else setError('Please select a PDF file.');
                  }}
                />
              </label>
            </div>

            <div className={labStyles.actionRow}>
              <button
                className={labStyles.primaryBtn}
                disabled={isLoading || (!selectedResumeId && !selectedFile)}
                onClick={handleProceedToJobContext}
              >
                {isLoading ? (
                  <><span className={labStyles.spinner} />Preparing…</>
                ) : (
                  <>Continue to Setup <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" /></svg></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* STEP 2: Interview Setup — wizard layout */}
      {viewMode === 'job-context' && parsedData && (
        <div className={styles.section} style={{ padding: 0, overflow: 'hidden' }}>
          {/* Wizard header */}
          <div className={labStyles.wizardHeader}>
            <div className={labStyles.wizardHeaderLeft}>
              <button className={labStyles.backBtn} onClick={() => setViewMode('select-resume')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                Back
              </button>
              <div>
                <h3 className={labStyles.wizardTitle}>Interview Setup</h3>
                <p className={labStyles.wizardSub}>Configure your session — takes 30 seconds</p>
              </div>
            </div>
            {sttAvailable === false && (
              <div className={labStyles.sttBanner}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                Voice system unavailable
              </div>
            )}
          </div>

          <div className={labStyles.wizardBody}>
            {/* SECTION A — Target Role */}
            <div className={labStyles.wizardSection}>
              <div className={labStyles.wizardSectionLabel}>
                <span className={labStyles.wizardSectionNum}>1</span>
                Target Role
                <span className={labStyles.wizardRequired}>*</span>
              </div>
              <div className={labStyles.roleCardGrid}>
                {ROLES.map(role => (
                  <button
                    key={role}
                    className={`${labStyles.roleCard2} ${jobContext.target_role === role ? labStyles.roleCard2Active : ''}`}
                    onClick={() => setJobContext(j => ({ ...j, target_role: role }))}
                  >
                    <div className={labStyles.roleCard2Icon}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d={ROLE_ICONS[role] || 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'}/>
                      </svg>
                    </div>
                    <span className={labStyles.roleCard2Label}>{role}</span>
                    {jobContext.target_role === role && (
                      <div className={labStyles.roleCard2Check}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION B — Experience */}
            <div className={labStyles.wizardSection}>
              <div className={labStyles.wizardSectionLabel}>
                <span className={labStyles.wizardSectionNum}>2</span>
                Experience Level
                <span className={labStyles.wizardRequired}>*</span>
              </div>
              <div className={labStyles.expRow}>
                {EXPERIENCE_LEVELS.map((lv, idx) => (
                  <button
                    key={lv.value}
                    className={`${labStyles.expBtn} ${jobContext.experience_level === lv.value ? labStyles.expBtnActive : ''}`}
                    onClick={() => setJobContext(j => ({ ...j, experience_level: lv.value }))}
                  >
                    <div className={labStyles.expBtnBar}>
                      {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className={`${labStyles.expBar} ${i <= idx ? labStyles.expBarFill : ''}`} />
                      ))}
                    </div>
                    <span>{lv.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION C — Interview Type */}
            <div className={labStyles.wizardSection}>
              <div className={labStyles.wizardSectionLabel}>
                <span className={labStyles.wizardSectionNum}>3</span>
                Interview Type
                <span className={labStyles.wizardRequired}>*</span>
              </div>
              <div className={labStyles.typeCardRow}>
                {INTERVIEW_TYPES.map(t => (
                  <button
                    key={t.value}
                    className={`${labStyles.typeCard} ${jobContext.interview_type === t.value ? labStyles.typeCardActive : ''}`}
                    style={jobContext.interview_type === t.value ? { borderColor: t.color, background: `${t.color}12` } : {}}
                    onClick={() => setJobContext(j => ({ ...j, interview_type: t.value }))}
                  >
                    <div className={labStyles.typeCardIcon} style={{ background: jobContext.interview_type === t.value ? `${t.color}22` : '#f1f5f9' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={jobContext.interview_type === t.value ? t.color : '#94a3b8'}>
                        <path d={t.icon}/>
                      </svg>
                    </div>
                    <div className={labStyles.typeCardLabel} style={{ color: jobContext.interview_type === t.value ? t.color : '#1e293b' }}>
                      {t.label}
                    </div>
                    <div className={labStyles.typeCardDesc}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Wizard footer — preview + start */}
          <div className={labStyles.wizardFooter}>
            <div className={labStyles.wizardPreview}>
              {jobContext.target_role || jobContext.experience_level || jobContext.interview_type ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#64748b"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  <span>Session:</span>
                  {jobContext.target_role && <span className={labStyles.previewTag}>{jobContext.target_role}</span>}
                  {jobContext.experience_level && <span className={labStyles.previewTag}>{jobContext.experience_level}</span>}
                  {jobContext.interview_type && <span className={labStyles.previewTag}>{jobContext.interview_type}</span>}
                </>
              ) : (
                <span style={{ color: '#94a3b8' }}>Select options above to continue</span>
              )}
            </div>
            <button
              className={labStyles.startBtn}
              disabled={isStarting || sttAvailable === false || !jobContext.target_role || !jobContext.experience_level || !jobContext.interview_type}
              onClick={handleStartInterview}
            >
              {isStarting ? (
                <><span className={labStyles.spinner} />Starting...</>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 0h-2c0 2.76-2.24 5-5 5S6 7.76 6 5H4c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92z"/>
                  </svg>
                  Start Interview
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: AI Interview (Voice — fullscreen) ───────────────────── */}
      {viewMode === 'interview' && session && session.current_question && (
        <div className={styles.section} style={{ padding: 0, overflow: 'hidden' }}>
          <VoiceInterview
            session={session}
            conversationHistory={conversationHistory}
            onAnswerSubmit={handleVoiceAnswerSubmit}
            onSkip={handleVoiceSkip}
            onEndInterview={handleEndInterviewEarly}
            isLoading={isLoading}
            currentEvaluation={currentEvaluation}
            onNextQuestion={pendingNextQuestion ? handleNextQuestion : undefined}
          />
        </div>
      )}

      {/* ─── STEP 4: Summary ──────────────────────────────────────────────── */}
      {viewMode === 'summary' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>🎉 Interview Complete!</h3>
          </div>
          <div className={labStyles.summaryBody}>
            <div className={labStyles.summaryIcon}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="#22c55e"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            </div>
            <h2 className={labStyles.summaryTitle}>Great job!</h2>
            <p className={labStyles.summarySubtitle}>
              {interviewAnswers.filter((a: InterviewAnswer) => !a.isSkipped).length} answered ·{' '}
              {interviewAnswers.filter((a: InterviewAnswer) => a.isSkipped).length} skipped
            </p>
            <p className={labStyles.summaryNote}>Your session has been saved. View full results in <strong>My Interviews</strong>.</p>

            {interviewAnswers.length > 0 && (
              <div className={labStyles.summaryAnswers}>
                <p className={labStyles.summaryAnswersTitle}>Session Summary</p>
                {interviewAnswers.map((ans: InterviewAnswer, idx: number) => {
                  const ev: Evaluation | undefined = answerEvaluations.get(idx);
                  const confColor = ev?.score_confidence === 'high' ? '#16a34a' : ev?.score_confidence === 'low' ? '#dc2626' : '#d97706';
                  const isFallback = ev?.metadata?.fallback === true;
                  return (
                    <div key={idx} className={`${labStyles.summaryCard} ${ans.isSkipped ? labStyles.summaryCardSkipped : ''}`}>
                      <div className={labStyles.summaryCardTop}>
                        <span className={labStyles.qNum}>Q{ans.questionNumber}</span>
                        <span className={labStyles.qCat}>{ans.category}</span>
                        <span className={labStyles.qDiff}>{ans.difficulty}</span>
                        {ev && !ans.isSkipped && !isFallback && (
                          <span className={labStyles.qScore} style={{ color: ev.average_score >= 7 ? '#16a34a' : ev.average_score >= 5 ? '#d97706' : '#dc2626' }}>
                            ⭐ {ev.average_score?.toFixed(1)}/10
                          </span>
                        )}
                        {ev?.score_confidence && !ans.isSkipped && !isFallback && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 99, background: `${confColor}18`, color: confColor, fontWeight: 600, marginLeft: 4 }}>
                            {ev.score_confidence === 'high' ? '✓ High' : ev.score_confidence === 'low' ? '⚠ Low' : '~ Med'} confidence
                          </span>
                        )}
                        {isFallback && !ans.isSkipped && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                            ⚠ Score unavailable
                          </span>
                        )}
                        {ans.isSkipped && <span className={labStyles.skippedTag}>Skipped</span>}
                      </div>
                      <p className={labStyles.summaryQText}>{ans.questionText}</p>
                      {!ans.isSkipped && <p className={labStyles.summaryAText}>{ans.answerText || <em>No answer</em>}</p>}

                      {ev && !ans.isSkipped && !isFallback && (
                        <div style={{ marginTop: '10px' }}>
                          <EvaluationBreakdown
                            score={ev.average_score}
                            reasoning={ev.feedback}
                            strengths={ev.strengths || []}
                            gaps={ev.weak_areas || ev.weaknesses || []}
                            llm_used={ev.metadata?.fallback !== true}
                            dataset_match_type={ev.metadata?.strong_match ? 'strong_match' : 'no_match'}
                            difficulty={(ev.difficulty as 'easy' | 'medium' | 'hard') || 'medium'}
                          />
                        </div>
                      )}

                      {isFallback && !ans.isSkipped && (
                        <div className={labStyles.evalBox} style={{ background: '#fffbeb', borderLeft: '3px solid #f59e0b' }}>
                          <p style={{ color: '#92400e', fontSize: '0.83rem', margin: 0 }}>{ev?.feedback || 'Evaluation was unavailable for this answer. Your response was recorded.'}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}


            <button className={labStyles.primaryBtn} onClick={resetAll} style={{ marginTop: '1.5rem' }}>
              Start New Interview
            </button>
          </div>
        </div>
      )}

      <div ref={conversationEndRef} />
    </div>
  );
};

export default PracticeTestsMain;
