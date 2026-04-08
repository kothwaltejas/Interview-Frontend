import React, { useState, useEffect, useRef } from 'react';
import styles from './Dashboard.module.css';
import { supabase } from '../lib/supabase';
import VoiceInterview from '../components/VoiceInterview';

// Types
interface ParsedResumeData {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: any[];
  projects: any[];
  education: any[];
}

interface JobContext {
  target_role: string;
  experience_level: string;
  interview_type: string;
}

interface InterviewQuestion {
  id: number;
  question: string;
  category: string;
  difficulty: string;
  focus_area: string;
  expected_duration_seconds: number;
  question_number?: number;
  total_questions?: number;
}

interface SessionState {
  session_id: string;
  current_question: InterviewQuestion | null;
  progress: { current: number; total: number };
}

interface Evaluation {
  feedback: string;
  score: number;
  follow_up_question?: string;
}

interface ConversationMessage {
  role: 'interviewer' | 'candidate';
  message: string;
  timestamp: Date;
}

/**
 * Interface for storing interview answers for feedback analysis.
 * Each answer includes the question, response, and metadata for later evaluation.
 */
interface InterviewAnswer {
  questionId: number;
  questionNumber: number;
  questionText: string;
  category: string;
  difficulty: string;
  answerText: string;
  isSkipped: boolean;
  timestamp: Date;
  timeTakenSeconds?: number;
}

type ViewMode = 'upload' | 'job-context' | 'interview' | 'summary';
// Voice-only interview mode (text mode removed)

const PracticeTestsMain: React.FC = () => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedResumeData | null>(null);
  const [jobContext, setJobContext] = useState<JobContext>({
    target_role: '',
    experience_level: '',
    interview_type: ''
  });
  const [session, setSession] = useState<SessionState | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_currentAnswer, setCurrentAnswer] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_evaluation, _setEvaluation] = useState<Evaluation | null>(null);
  
  // Store all interview answers for feedback analysis
  const [interviewAnswers, setInterviewAnswers] = useState<InterviewAnswer[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  // NEW: Store evaluations for each answer
  const [answerEvaluations, setAnswerEvaluations] = useState<Map<number, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showingResponse, setShowingResponse] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Voice-only mode
  const [sttAvailable, setSttAvailable] = useState<boolean | null>(null); // null = checking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_authToken, setAuthToken] = useState<string | null>(null);
  
  // Ref for scrolling to bottom of conversation
  const conversationEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest message
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  // Log collected answers when interview completes (for feedback analysis)
  useEffect(() => {
    if (viewMode === 'summary' && interviewAnswers.length > 0) {
      console.log('📊 Interview completed - Answers collected for feedback analysis:');
      console.log('Total answers:', interviewAnswers.length);
      console.log('Answered:', interviewAnswers.filter(a => !a.isSkipped).length);
      console.log('Skipped:', interviewAnswers.filter(a => a.isSkipped).length);
      console.log('Answers data:', interviewAnswers);
    }
  }, [viewMode, interviewAnswers]);

  // New: Check if STT service is available on backend
  useEffect(() => {
    const checkSTTAvailability = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/audio/stt/status');
        const result = await response.json();
        setSttAvailable(result.available);
        console.log('STT availability:', result.available ? '✅ Available' : '❌ Not available');
      } catch (err) {
        console.log('STT service check failed - voice mode disabled');
        setSttAvailable(false);
      }
    };
    
    checkSTTAvailability();
  }, []);

  // Helper: Get auth token (also updates state for voice mode)
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || null;
    setAuthToken(token);
    return token;
  };

  /**
   * Record an answer for feedback analysis.
   * Called when user submits or skips a question.
   * CRITICAL: Includes duplicate check to prevent recording same question twice
   */
  const recordAnswer = (answerText: string, isSkipped: boolean = false) => {
    if (!session?.current_question) return;
    
    const question = session.current_question;
    
    // DUPLICATE CHECK: Don't record if we already have an answer for this question
    setInterviewAnswers(prev => {
      const alreadyRecorded = prev.some(a => a.questionId === question.id);
      if (alreadyRecorded) {
        console.log('⚠️ Answer already recorded for question', question.id, '- skipping duplicate');
        return prev;
      }
      
      const answer: InterviewAnswer = {
        questionId: question.id,
        questionNumber: session.progress.current,
        questionText: question.question,
        category: question.category,
        difficulty: question.difficulty,
        answerText: answerText,
        isSkipped: isSkipped,
        timestamp: new Date(),
      };
      
      console.log('📝 Answer recorded for feedback:', {
        questionNumber: answer.questionNumber,
        category: answer.category,
        isSkipped: answer.isSkipped,
        answerLength: answer.answerText.length
      });
      
      return [...prev, answer];
    });
  };

  // Voice mode: Handle answer submit (reuses existing logic)
  const handleVoiceAnswerSubmit = async (answerText: string) => {
    if (!session) return;
    
    // Record answer for feedback analysis BEFORE submitting
    // This ensures we save even if submission fails
    recordAnswer(answerText, false);
    
    // Add candidate's answer to conversation
    setConversationHistory(prev => [...prev, {
      role: 'candidate',
      message: answerText,
      timestamp: new Date()
    }]);
    
    // NEW: Store evaluation if available
    const answerIndex = session.progress.current - 1;
    
    await handleAnswerSubmission(answerText);
    
    // After submission, response might include evaluation
    // It will be captured in handleAnswerSubmission
  };

  // Voice mode: Handle skip (reuses existing logic)
  // NOTE: Do NOT call recordAnswer here - handleSkipQuestion already does it
  const handleVoiceSkip = async () => {
    await handleSkipQuestion();
  };

  // Voice mode: End interview early
  const handleEndInterviewEarly = async () => {
    if (!session) return;
    
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const summaryResponse = await fetch(`http://localhost:8000/api/session/${session.session_id}/summary`, {
        method: 'GET',
        headers
      });
      
      const summaryResult = await summaryResponse.json();
      
      if (summaryResult.saved_to_database) {
        console.log('✅ Interview saved to database! Session ID:', summaryResult.db_session_id);
      }
    } catch (err) {
      console.error('Failed to save interview:', err);
    }
    
    setViewMode('summary');
  };

  // Shared answer submission logic (used by both text and voice modes)
  const handleAnswerSubmission = async (answerText: string) => {
    if (!session) return;

    setIsLoading(true);
    setShowingResponse(true);

    try {
      const response = await fetch('http://localhost:8000/api/session/conversational-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          answer_text: answerText,
          time_taken_seconds: 0
        }),
      });

      const result = await response.json();

      if (result.success) {
        // NEW: Store evaluation if available in the response
        if (result.evaluation) {
          const questionIndex = session.progress.current - 1;
          setAnswerEvaluations(prev => new Map(prev).set(questionIndex, result.evaluation));
          console.log(`📊 Evaluation captured for question ${session.progress.current}`);
        }
        
        // Check if interview is complete
        if (result.is_complete) {
          // Add final acknowledgment
          setConversationHistory(prev => [...prev, {
            role: 'interviewer',
            message: result.interviewer_response,
            timestamp: new Date()
          }]);
          
          // Save interview to database by calling summary endpoint
          setTimeout(async () => {
            try {
              const token = await getAuthToken();
              const headers: HeadersInit = { 'Content-Type': 'application/json' };
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }
              
              const summaryResponse = await fetch(`http://localhost:8000/api/session/${session.session_id}/summary`, {
                method: 'GET',
                headers
              });
              
              const summaryResult = await summaryResponse.json();
              
              if (summaryResult.saved_to_database) {
                console.log('✅ Interview saved to database! Session ID:', summaryResult.db_session_id);
              } else {
                console.log('ℹ️ Interview completed but not saved (no authentication)');
              }
            } catch (err) {
              console.error('Failed to save interview:', err);
            }
            
            setViewMode('summary');
          }, 2000);
        } else {
          // Combine acknowledgment and next question in single message
          const nextQuestionText = result.next_question?.question || 'Next question coming up...';
          const combinedMessage = `${result.interviewer_response}\n\n${nextQuestionText}`;
          
          setTimeout(() => {
            setConversationHistory(prev => [...prev, {
              role: 'interviewer',
              message: combinedMessage,
              timestamp: new Date()
            }]);
            
            setSession({
              ...session,
              current_question: result.next_question,
              progress: result.progress
            });
            setShowingResponse(false);
          }, 1000);
        }
      }
    } catch (err) {
      setError('Failed to submit answer');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resume Upload & Parse
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleParseResume = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('file', selectedFile);

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://localhost:8000/api/resume/parse', {
        method: 'POST',
        headers,
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setParsedData(result.data);
        setViewMode('job-context');
        
        // Log database save status
        if (result.saved_to_database) {
          console.log('✅ Resume saved to database with ID:', result.resume_id);
        } else {
          console.log('ℹ️ Resume parsed but not saved (no authentication)');
        }
      } else {
        setError(result.error || 'Failed to parse resume');
      }
    } catch (err: any) {
      setError('Failed to parse resume');
    } finally {
      setIsLoading(false);
    }
  };

  // Start Interview Session
  const handleStartInterview = async () => {
    if (!parsedData || !jobContext.target_role || !jobContext.experience_level || !jobContext.interview_type) {
      setError('Please fill all job context fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/session/create-conversational', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'user123', // TODO: Get from auth context
          resume_data: parsedData,
          job_context: jobContext,
          num_questions: 10
        }),
      });

      const result = await response.json();

      if (result.success) {
        const openingQuestion = result.opening_question || result.current_question;
        setSession({
          session_id: result.session_id,
          current_question: openingQuestion,
          progress: { current: 1, total: result.total_questions }
        });
        // Reset interview answers for new session
        setInterviewAnswers([]);
        // NEW: Reset evaluations for new session
        setAnswerEvaluations(new Map());
        // Add opening question to conversation
        setConversationHistory([{
          role: 'interviewer',
          message: openingQuestion.question,
          timestamp: new Date()
        }]);
        setViewMode('interview');
      } else {
        setError('Failed to start interview session');
      }
    } catch (err) {
      setError('Failed to start interview');
    } finally {
      setIsLoading(false);
    }
  };

  // Skip Question
  const handleSkipQuestion = async () => {
    if (!session) return;

    // Record skipped question for feedback analysis
    recordAnswer('', true);

    // Add skip note to conversation
    setConversationHistory(prev => [...prev, {
      role: 'candidate',
      message: '[Question skipped]',
      timestamp: new Date()
    }]);

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/session/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.session_id }),
      });

      const result = await response.json();

      if (result.success) {
        // Check if interview completed
        const nextQuestion = result.result?.next_question;
        
        if (!nextQuestion || result.result?.status === 'completed') {
          // Save interview to database by calling summary endpoint
          try {
            const token = await getAuthToken();
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            
            const summaryResponse = await fetch(`http://localhost:8000/api/session/${session.session_id}/summary`, {
              method: 'GET',
              headers
            });
            
            const summaryResult = await summaryResponse.json();
            
            if (summaryResult.saved_to_database) {
              console.log('✅ Interview saved to database! Session ID:', summaryResult.db_session_id);
            } else {
              console.log('ℹ️ Interview completed but not saved (no authentication)');
            }
          } catch (err) {
            console.error('Failed to save interview:', err);
          }
          
          setTimeout(() => setViewMode('summary'), 1000);
        } else {
          // Combine transition message and next question
          const nextQuestionText = nextQuestion?.question || 'Next question coming up...';
          const combinedMessage = `No problem. Let's move on to the next question.\n\n${nextQuestionText}`;
          
          setTimeout(() => {
            setConversationHistory(prev => [...prev, {
              role: 'interviewer',
              message: combinedMessage,
              timestamp: new Date()
            }]);
            
            setSession({
              ...session,
              current_question: nextQuestion,
              progress: {
                current: nextQuestion.question_number || (session.progress.current + 1),
                total: nextQuestion.total_questions || session.progress.total
              }
            });
            setCurrentAnswer('');
          }, 800);
        }
      }
    } catch (err) {
      setError('Failed to skip question');
    } finally {
      setIsLoading(false);
    }
  };

  // Render based on view mode
  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      
      <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>AI Interview Practice</h1>
        <p className={styles.welcomeSubtitle}>
          {viewMode === 'upload' && 'Upload your resume to start'}
          {viewMode === 'job-context' && 'Tell us about the role you\'re applying for'}
          {viewMode === 'interview' && 'Have a natural conversation with the AI interviewer'}
          {viewMode === 'summary' && 'Interview completed'}
        </p>
      </div>

      {/* Upload View */}
      {viewMode === 'upload' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z"/>
              </svg>
              Upload Resume
            </h3>
          </div>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <label htmlFor="resume-upload" style={{
              display: 'inline-block',
              background: '#f8fafc',
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '3rem',
              cursor: 'pointer',
              width: '100%',
              maxWidth: '500px'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="#64748b">
                  <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z"/>
                </svg>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                {selectedFile ? selectedFile.name : 'Click to upload your resume'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>PDF files only, max 10MB</div>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
            
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
              {selectedFile && (
                <button
                  onClick={handleParseResume}
                  disabled={isLoading}
                  style={{
                    background: isLoading ? '#94a3b8' : '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '1rem 2rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  {isLoading ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 6V2l-5 5 5 5V8c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C18.6 17.33 19 15.7 19 14c0-3.87-3.13-7-7-7z"/>
                        <path d="M6 14c0-3.31 2.69-6 6-6v4l5-5-5-5v4C8.13 6 5 9.13 5 14c0 1.7.4 3.33 1.24 4.26L7.7 16.8C7.25 15.97 7 15.01 7 14z"/>
                      </svg>
                      Parsing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                      Parse Resume
                    </>
                  )}
                </button>
              )}
            </div>
            
            {error && (
              <div style={{ marginTop: '1rem', color: '#dc2626', background: '#fef2f2', padding: '1rem', borderRadius: '8px' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job Context View */}
      {viewMode === 'job-context' && parsedData && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Interview Details
            </h3>
          </div>
          <div style={{ padding: '2rem' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Target Role *
                </label>
                <select
                  value={jobContext.target_role}
                  onChange={(e) => setJobContext({ ...jobContext, target_role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">Select target role</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="Mobile App Developer">Mobile App Developer</option>
                  <option value="DevOps Engineer">DevOps Engineer</option>
                  <option value="Data Engineer">Data Engineer</option>
                  <option value="Machine Learning Engineer">Machine Learning Engineer</option>
                  <option value="QA Engineer">QA Engineer</option>
                  <option value="UI/UX Designer">UI/UX Designer</option>
                  <option value="Product Manager">Product Manager</option>
                  <option value="Software Architect">Software Architect</option>
                  <option value="Cloud Engineer">Cloud Engineer</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Experience Level *
                </label>
                <select
                  value={jobContext.experience_level}
                  onChange={(e) => setJobContext({ ...jobContext, experience_level: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">Select experience level</option>
                  <option value="Fresher">Fresher</option>
                  <option value="1-3 years">1-3 years</option>
                  <option value="3-5 years">3-5 years</option>
                  <option value="5+ years">5+ years</option>
                </select>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Interview Type *
                </label>
                <select
                  value={jobContext.interview_type}
                  onChange={(e) => setJobContext({ ...jobContext, interview_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">Select interview type</option>
                  <option value="Technical">Technical</option>
                  <option value="HR">HR/Behavioral</option>
                  <option value="Mixed">Mixed (Technical + HR)</option>
                </select>
              </div>

              {/* Voice Interview Info */}
              <div style={{
                marginBottom: '2rem',
                padding: '1.25rem',
                background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
                border: '2px solid #93c5fd',
                borderRadius: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #2563EB, #3b82f6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                  }}>
                    🎤
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e40af' }}>
                      Voice Interview Mode
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#3b82f6' }}>
                      Real interview experience with AI
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  fontSize: '0.875rem',
                  color: '#1e3a5f',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📹</span> Camera enabled
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🗣️</span> AI speaks questions
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🎙️</span> Voice transcription
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>⏱️</span> Auto silence detection
                  </div>
                </div>

                {!sttAvailable && sttAvailable !== null && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    color: '#92400e',
                  }}>
                    ⚠️ Speech-to-Text service unavailable. Please ensure the backend is running.
                  </div>
                )}
              </div>

              <button
                onClick={handleStartInterview}
                disabled={isLoading || !sttAvailable || !jobContext.target_role || !jobContext.experience_level || !jobContext.interview_type}
                style={{
                  width: '100%',
                  background: (isLoading || !sttAvailable) ? '#94a3b8' : 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  cursor: (isLoading || !sttAvailable) ? 'not-allowed' : 'pointer',
                  boxShadow: (isLoading || !sttAvailable) ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.4)',
                  transition: 'all 0.3s ease',
                }}
              >
                {isLoading ? '🔄 Starting Interview...' : '🎤 Start Voice Interview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interview View - Voice Mode Only */}
      {viewMode === 'interview' && session && session.current_question && (
        <div className={styles.section} style={{ padding: 0, overflow: 'hidden' }}>
          <VoiceInterview
            session={session}
            conversationHistory={conversationHistory}
            onAnswerSubmit={handleVoiceAnswerSubmit}
            onSkip={handleVoiceSkip}
            onEndInterview={handleEndInterviewEarly}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Summary View */}
      {viewMode === 'summary' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>🎉 Interview Complete!</h3>
          </div>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="#22c55e">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h2 style={{ marginBottom: '0.5rem' }}>Great job completing the interview!</h2>
            <p style={{ color: '#64748b' }}>Review your detailed analysis in the summary section</p>
            
            {/* Answer Summary for Feedback Analysis */}
            {interviewAnswers.length > 0 && (
              <div style={{ 
                marginTop: '2rem', 
                padding: '1.5rem',
                background: '#f8fafc',
                borderRadius: '12px',
                textAlign: 'left',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <h4 style={{ marginBottom: '1rem', color: '#1e293b' }}>
                  📝 Your Answers & Evaluations ({interviewAnswers.filter(a => !a.isSkipped).length} answered, {interviewAnswers.filter(a => a.isSkipped).length} skipped)
                </h4>
                {interviewAnswers.map((answer, idx) => {
                  const evaluation = answerEvaluations.get(idx);
                  
                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        background: answer.isSkipped ? '#fef3c7' : '#ffffff',
                        borderRadius: '8px',
                        border: `1px solid ${answer.isSkipped ? '#fcd34d' : '#e2e8f0'}`
                      }}
                    >
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: '#64748b', 
                        marginBottom: '0.5rem',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center'
                      }}>
                        <span>Q{answer.questionNumber}</span>
                        <span style={{ 
                          background: '#e2e8f0', 
                          padding: '0.125rem 0.5rem', 
                          borderRadius: '4px',
                          fontSize: '0.7rem'
                        }}>
                          {answer.category}
                        </span>
                        <span style={{ 
                          background: answer.difficulty === 'hard' ? '#fee2e2' : answer.difficulty === 'medium' ? '#fef3c7' : '#dcfce7',
                          padding: '0.125rem 0.5rem', 
                          borderRadius: '4px',
                          fontSize: '0.7rem'
                        }}>
                          {answer.difficulty}
                        </span>
                        {/* NEW: Show evaluation score if available */}
                        {evaluation && !answer.isSkipped && (
                          <span style={{ 
                            background: `${evaluation.average_score >= 7 ? '#dcfce7' : evaluation.average_score >= 5 ? '#fef3c7' : '#fee2e2'}`,
                            padding: '0.125rem 0.5rem', 
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: '600'
                          }}>
                            ⭐ {evaluation.average_score.toFixed(1)}/10
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 500, color: '#1e293b', marginBottom: '0.5rem' }}>
                        {answer.questionText}
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        {answer.isSkipped ? (
                          <em style={{ color: '#d97706' }}>⏭️ Skipped</em>
                        ) : (
                          answer.answerText || <em style={{ color: '#94a3b8' }}>No answer recorded</em>
                        )}
                      </div>
                      {/* NEW: Show feedback if evaluation is available */}
                      {evaluation && !answer.isSkipped && (
                        <div style={{
                          marginTop: '0.75rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid #e2e8f0',
                          fontSize: '0.85rem'
                        }}>
                          <div style={{ color: '#475569', marginBottom: '0.5rem' }}>
                            <strong>💭 Feedback:</strong> {evaluation.feedback}
                          </div>
                          {evaluation.strengths && evaluation.strengths.length > 0 && (
                            <div style={{ color: '#16a34a', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                              <strong>✨ Strengths:</strong> {evaluation.strengths.slice(0, 2).join(', ')}
                            </div>
                          )}
                          {evaluation.weak_areas && evaluation.weak_areas.length > 0 && (
                            <div style={{ color: '#dc2626', fontSize: '0.8rem' }}>
                              <strong>📈 Focus Areas:</strong> {evaluation.weak_areas.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            <button
              onClick={() => {
                setViewMode('upload');
                setSession(null);
                setParsedData(null);
                setSelectedFile(null);
                setInterviewAnswers([]);
                setAnswerEvaluations(new Map());  // NEW: Clear evaluations
                setConversationHistory([]);
                setShowingResponse(false);
              }}
              style={{
                marginTop: '2rem',
                background: '#2563EB',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Start New Interview
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default PracticeTestsMain;
