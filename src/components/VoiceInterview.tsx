/**
 * VoiceInterview - Two-window voice-based interview component
 * 
 * Layout:
 * ┌────────────────────────────────────────────────────────────┐
 * │              AI INTERVIEWER WINDOW                         │
 * │  ┌──────────────┐                                         │
 * │  │   🤖 Avatar  │  "Tell me about your experience..."     │
 * │  └──────────────┘                                         │
 * ├────────────────────────────────────────────────────────────┤
 * │                USER CAMERA WINDOW                          │
 * │  ┌──────────────┐    Status: Listening...                 │
 * │  │   👤 Video   │    [Audio Level Indicator]              │
 * │  └──────────────┘    [Skip] [End Interview]               │
 * └────────────────────────────────────────────────────────────┘
 * 
 * Flow:
 * 1. AI speaks question (TTS)
 * 2. Mic auto-opens when TTS ends
 * 3. User answers by voice
 * 4. Silence detection stops recording
 * 5. Audio sent to backend for STT
 * 6. Transcript sent to existing interview logic
 * 7. AI responds → Repeat
 * 
 * This component is a WRAPPER around existing interview logic.
 * It does NOT modify how interviews work - only HOW user interacts.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

// Types from PracticeTests
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

interface ConversationMessage {
  role: 'interviewer' | 'candidate';
  message: string;
  timestamp: Date;
}

interface VoiceInterviewProps {
  session: SessionState;
  conversationHistory: ConversationMessage[];
  onAnswerSubmit: (answerText: string) => Promise<void>;
  onSkip: () => Promise<void>;
  onEndInterview: () => void;
  isLoading: boolean;
}

// Interview states for clear UI and flow management
type InterviewPhase = 
  | 'INITIALIZING_TTS' // Waiting for TTS engine to be ready
  | 'READY_TO_START'   // TTS ready, waiting for user to click start
  | 'AI_SPEAKING'      // AI is speaking the question
  | 'WAITING_TO_RECORD' // Brief pause before recording starts
  | 'RECORDING'        // User is speaking
  | 'PROCESSING_STT'   // Converting speech to text
  | 'PROCESSING_ANSWER' // Backend processing answer
  | 'IDLE';            // Between turns

const VoiceInterview: React.FC<VoiceInterviewProps> = ({
  session,
  conversationHistory,
  onAnswerSubmit,
  onSkip,
  onEndInterview,
  isLoading,
}) => {
  // ============ STATE ============
  const [phase, setPhase] = useState<InterviewPhase>('INITIALIZING_TTS');
  const [lastSpokenMessage, setLastSpokenMessage] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Silence detection and auto-skip states
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null); // 3, 2, 1, then skip
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasSpokenCurrentQuestion = useRef(false);
  const hasUserSpokenThisRecording = useRef(false);  // Track if user spoke during current recording
  const recordingStartTimeRef = useRef<number | null>(null);  // When recording started
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);  // Timer for 7s silence detection
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);  // Timer for 3-2-1 countdown
  const isAutoSkippingRef = useRef(false);  // Prevent race conditions during auto-skip
  const currentQuestionIdRef = useRef<number | null>(null);  // Track current question to detect changes
  const isCountdownActiveRef = useRef(false);  // Prevent countdown from restarting while active
  const isManuallySkippingRef = useRef(false);  // Prevent STT processing during manual skip

  // ============ HOOKS ============
  
  // Text-to-Speech for AI interviewer
  const tts = useTextToSpeech({
    onStart: () => {
      setPhase('AI_SPEAKING');
      console.log('🗣️ AI started speaking');
    },
    onEnd: () => {
      console.log('🗣️ AI finished speaking');
      // Small pause before opening mic (feels more natural)
      setPhase('WAITING_TO_RECORD');
      setTimeout(() => {
        startListening();
      }, 800);
    },
    onError: (err) => {
      console.error('TTS Error:', err);
      // If TTS fails, still allow recording
      setPhase('WAITING_TO_RECORD');
      setTimeout(startListening, 500);
    },
  });

  // Voice recorder with silence detection
  const recorder = useVoiceRecorder({
    silenceDuration: 1500, // 1.5 seconds of silence to stop
    autoStopOnSilence: true,
    onSilenceDetected: () => {
      console.log('🔇 Silence detected');
    },
    onRecordingComplete: async (blob) => {
      console.log('🎤 Recording complete:', blob.size, 'bytes');
      await handleRecordingComplete(blob);
    },
    onError: (err) => {
      setError(err);
      setPhase('IDLE');
    },
  });

  // ============ CAMERA SETUP ============
  
  useEffect(() => {
    const initCamera = async () => {
      try {
        console.log('📹 Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false, // Audio handled separately by recorder
        });
        
        console.log('📹 Camera stream obtained successfully');
        setCameraStream(stream);
        
        if (videoRef.current) {
          console.log('📹 Attaching stream to video element');
          videoRef.current.srcObject = stream;
        } else {
          console.log('📹 Video element not ready yet, will attach later');
        }
      } catch (err) {
        console.error('📹 Camera error:', err);
        setCameraError('Could not access camera. Please ensure camera permissions are granted.');
      }
    };

    initCamera();

    // Cleanup camera on unmount
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Re-attach stream when phase changes (video element may not exist during loading)
  useEffect(() => {
    if (phase !== 'INITIALIZING_TTS' && phase !== 'READY_TO_START') {
      // We're now in the main view where video element exists
      // Use small delay to ensure video element is mounted
      const timer = setTimeout(() => {
        if (videoRef.current && cameraStream) {
          console.log('📹 Re-attaching camera stream to video element');
          videoRef.current.srcObject = cameraStream;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, cameraStream]);

  // Reset spoken flag when question changes (allow new question to be spoken)
  useEffect(() => {
    if (session.current_question) {
      const newQuestionId = session.current_question.id;
      
      // Check if question actually changed
      if (currentQuestionIdRef.current !== newQuestionId) {
        console.log('📝 Question changed:', currentQuestionIdRef.current, '→', newQuestionId);
        currentQuestionIdRef.current = newQuestionId;
        
        // Reset ALL skip-related flags for new question
        isAutoSkippingRef.current = false;
        isManuallySkippingRef.current = false;
        isCountdownActiveRef.current = false;
        hasUserSpokenThisRecording.current = false;
        recordingStartTimeRef.current = null;
        
        // Clear any pending timers
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setSilenceCountdown(null);
        setShowSkipWarning(false);
      }
      
      // When question ID changes, reset so next message will be spoken
      hasSpokenCurrentQuestion.current = false;
      setTranscript('');
      setError(null);
    }
  }, [session.current_question?.id]);

  // ============ INTERVIEW FLOW ============

  /**
   * Speak the AI interviewer's message
   * Called when new interviewer message appears in conversation
   */
  const speakInterviewerMessage = useCallback((message: string) => {
    if (message === lastSpokenMessage) return;
    if (!message || message.trim().length === 0) return;
    
    console.log('🗣️ Speaking message:', message.substring(0, 50) + '...');
    setLastSpokenMessage(message);
    hasSpokenCurrentQuestion.current = true;
    setError(null); // Clear any previous errors
    tts.speak(message);
  }, [lastSpokenMessage, tts]);

  // =================================================================
  // CRITICAL: FIRST QUESTION - WAIT FOR TTS AND QUESTION TO BE READY
  // Then transition to READY_TO_START phase for user to click button
  // (Browser requires user gesture before TTS can play audio)
  // =================================================================
  useEffect(() => {
    // Only handle initialization phase
    if (phase !== 'INITIALIZING_TTS') return;
    
    // Wait for TTS to be ready
    if (!tts.isReady) {
      console.log('⏳ Waiting for TTS to initialize...');
      return;
    }
    
    // Get first interviewer message
    const firstInterviewerMessage = conversationHistory.find(
      msg => msg.role === 'interviewer'
    );
    
    // Wait for conversation history to have the first question
    if (!firstInterviewerMessage?.message) {
      console.log('⏳ Waiting for first question...');
      return;
    }
    
    // ALL CONDITIONS MET - Show "Begin Interview" button
    console.log('✅ TTS Ready + Question Available - Ready to start!');
    setPhase('READY_TO_START');
    
  }, [phase, tts.isReady, conversationHistory]);

  /**
   * Handle user clicking "Begin Interview" button
   * This provides the user gesture needed for TTS to work in browsers
   */
  const handleBeginInterview = useCallback(() => {
    console.log('🎬 User clicked Begin Interview');
    
    // Get first interviewer message
    const firstInterviewerMessage = conversationHistory.find(
      msg => msg.role === 'interviewer'
    );
    
    if (!firstInterviewerMessage?.message) {
      console.error('No first question found!');
      return;
    }
    
    console.log('🎤 SPEAKING FIRST QUESTION (user gesture provided)');
    console.log('📝 Question:', firstInterviewerMessage.message.substring(0, 50) + '...');
    
    // Set phase immediately (don't wait for onStart callback)
    setPhase('AI_SPEAKING');
    
    // Mark as spoken and speak
    hasSpokenCurrentQuestion.current = true;
    setLastSpokenMessage(firstInterviewerMessage.message);
    tts.speak(firstInterviewerMessage.message);
  }, [conversationHistory, tts]);

  // Watch for new interviewer messages and speak them
  // ONLY after user has started the interview (clicked Begin Interview button)
  useEffect(() => {
    // Don't auto-speak during initialization phases
    if (phase === 'INITIALIZING_TTS' || phase === 'READY_TO_START') {
      console.log('⏸️ Skipping auto-speak - still in init phase:', phase);
      return;
    }
    
    if (conversationHistory.length === 0) return;
    
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    
    // Only speak interviewer messages
    if (lastMessage.role === 'interviewer' && !isLoading) {
      // Don't re-speak if we just spoke this
      if (lastMessage.message !== lastSpokenMessage) {
        speakInterviewerMessage(lastMessage.message);
      }
    }
  }, [phase, conversationHistory, isLoading, lastSpokenMessage, speakInterviewerMessage]);

  // ============ SILENCE DETECTION & AUTO-SKIP ============
  
  // Constants for silence detection
  const EXTENDED_SILENCE_THRESHOLD = 7000;  // 7 seconds of silence before warning
  const SPEECH_THRESHOLD = 15;  // Audio level above this = user is speaking
  const COUNTDOWN_SECONDS = 3;  // 3-2-1 countdown before skip
  
  /**
   * Clear all silence-related timers and reset countdown state
   */
  const clearSilenceTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    // Reset countdown active flag
    isCountdownActiveRef.current = false;
    setSilenceCountdown(null);
    setShowSkipWarning(false);
  }, []);

  /**
   * Start listening for user's voice answer
   */
  const startListening = useCallback(() => {
    // Reset silence tracking for new recording
    isAutoSkippingRef.current = false;  // Reset auto-skip flag
    hasUserSpokenThisRecording.current = false;
    recordingStartTimeRef.current = Date.now();
    clearSilenceTimers();
    
    setPhase('RECORDING');
    setTranscript('');
    recorder.startRecording();
    
    console.log('🎤 Recording started, silence detection active');
  }, [recorder, clearSilenceTimers]);

  /**
   * Handle auto-skip when countdown reaches 0
   */
  const handleAutoSkip = useCallback(async () => {
    // Prevent double-skip
    if (isAutoSkippingRef.current) {
      console.log('⚠️ Already auto-skipping, ignoring');
      return;
    }
    
    console.log('⏭️ Auto-skipping question due to extended silence');
    isAutoSkippingRef.current = true;  // Set flag to prevent recording callback from processing
    clearSilenceTimers();
    recorder.stopRecording();
    
    // Small delay to ensure recording is fully stopped, then skip
    setTimeout(async () => {
      await onSkip();
      // isAutoSkippingRef will be reset when new question arrives
    }, 200);
  }, [clearSilenceTimers, recorder, onSkip]);

  /**
   * Start the 3-2-1 countdown before auto-skip
   * Uses ref to prevent multiple countdowns from starting
   */
  const startSkipCountdown = useCallback(() => {
    // CRITICAL: Prevent countdown from restarting if already active
    if (isCountdownActiveRef.current) {
      console.log('⚠️ Countdown already active, ignoring duplicate start');
      return;
    }
    
    console.log('⚠️ Starting skip countdown');
    isCountdownActiveRef.current = true;  // Mark countdown as active
    setShowSkipWarning(true);
    setSilenceCountdown(COUNTDOWN_SECONDS);
    
    let count = COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      console.log(`⏳ Countdown: ${count}`);
      
      if (count <= 0) {
        // Countdown finished - auto skip
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        isCountdownActiveRef.current = false;
        handleAutoSkip();
      } else {
        setSilenceCountdown(count);
      }
    }, 1000);
  }, [handleAutoSkip]);

  /**
   * Monitor audio level during recording for silence/speech detection
   */
  useEffect(() => {
    // Only run during RECORDING phase
    if (phase !== 'RECORDING') {
      clearSilenceTimers();
      return;
    }

    const audioLevel = recorder.audioLevel;
    const isUserSpeaking = audioLevel > SPEECH_THRESHOLD;

    // User is speaking - cancel any pending skip
    if (isUserSpeaking) {
      if (!hasUserSpokenThisRecording.current) {
        console.log('🗣️ User started speaking - audio level:', audioLevel);
        hasUserSpokenThisRecording.current = true;
      }
      
      // Cancel countdown if user speaks during it
      if (showSkipWarning || silenceCountdown !== null) {
        console.log('✅ User spoke - cancelling skip countdown');
        clearSilenceTimers();
      }
      
      // Reset the silence timer since user is speaking
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }

    // Check for extended silence (only if not already showing warning)
    if (!showSkipWarning && silenceCountdown === null) {
      const timeSinceRecordingStart = Date.now() - (recordingStartTimeRef.current || Date.now());
      
      // Only start silence timer if:
      // 1. User hasn't spoken yet AND recording has been going for 7+ seconds
      // 2. OR user has spoken but now silent for 7+ seconds
      if (!hasUserSpokenThisRecording.current && timeSinceRecordingStart >= EXTENDED_SILENCE_THRESHOLD) {
        // User never spoke - start countdown
        if (!silenceTimerRef.current) {
          console.log('🔇 Extended silence detected (no speech) - starting countdown');
          startSkipCountdown();
        }
      } else if (hasUserSpokenThisRecording.current && !isUserSpeaking) {
        // User spoke before but now silent - start a new silence timer
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            console.log('🔇 Extended silence after speech - starting countdown');
            startSkipCountdown();
          }, EXTENDED_SILENCE_THRESHOLD);
        }
      }
    }
  }, [phase, recorder.audioLevel, showSkipWarning, silenceCountdown, clearSilenceTimers, startSkipCountdown]);

  // Cleanup timers on unmount or phase change
  useEffect(() => {
    return () => {
      clearSilenceTimers();
    };
  }, [clearSilenceTimers]);

  /**
   * Handle completed recording - send to STT backend
   * Checks multiple flags to avoid processing during skip/transition states
   */
  const handleRecordingComplete = async (audioBlob: Blob) => {
    // CRITICAL: Check if we're skipping (auto or manual) - don't process recording
    if (isAutoSkippingRef.current || isManuallySkippingRef.current) {
      console.log('⏭️ Recording completed during skip, ignoring (auto:', isAutoSkippingRef.current, 'manual:', isManuallySkippingRef.current, ')');
      return;
    }
    
    setPhase('PROCESSING_STT');
    setError(null);
    
    try {
      // Validate blob - be more lenient (reduced from 1000 to 500)
      if (!audioBlob || audioBlob.size < 500) {
        console.warn('Audio blob too small:', audioBlob?.size);
        // Don't show error for small blobs during skipping - just restart
        if (!isAutoSkippingRef.current && !isManuallySkippingRef.current) {
          setError('Recording too short. Please speak clearly and try again.');
        }
        setPhase('IDLE');
        setTimeout(startListening, 1500);
        return;
      }

      console.log('🎤 Sending audio to STT:', audioBlob.size, 'bytes, type:', audioBlob.type);

      // Send audio to backend for transcription
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('http://localhost:8000/api/audio/stt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('STT API error:', response.status, errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('STT Result:', result);

      if (result.success && result.transcript) {
        const transcribedText = result.transcript.trim();
        setTranscript(transcribedText);

        if (transcribedText.length > 0) {
          console.log('📝 Transcript:', transcribedText);
          setPhase('PROCESSING_ANSWER');
          
          // Pass transcript to existing interview logic
          await onAnswerSubmit(transcribedText);
          setPhase('IDLE');
        } else {
          // Empty transcript - maybe user didn't speak
          setError('No speech detected. Please speak clearly and try again.');
          setPhase('IDLE');
          setTimeout(startListening, 1500);
        }
      } else {
        // STT returned but no transcript
        const errorMsg = result.detail || result.error || 'Could not recognize speech';
        console.warn('STT returned no transcript:', result);
        setError(`${errorMsg}. Please try again.`);
        setPhase('IDLE');
        setTimeout(startListening, 1500);
      }
    } catch (err) {
      console.error('STT Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Speech recognition failed: ${errorMessage}. Click mic to retry.`);
      setPhase('IDLE');
      // Don't auto-restart on error - let user click to retry
    }
  };

  /**
   * Handle skip button - uses existing skip logic
   * Sets flags to prevent STT error messages during skip
   */
  const handleSkip = async () => {
    // CRITICAL: Set flags to prevent recording callback from processing
    isManuallySkippingRef.current = true;
    isAutoSkippingRef.current = true;  // Also prevent auto-skip race conditions
    
    // Clear all timers and stop processes
    clearSilenceTimers();
    recorder.stopRecording();
    tts.stop();
    
    // Reset state
    setTranscript('');
    setError(null);  // Clear any existing errors
    hasSpokenCurrentQuestion.current = false;
    
    setPhase('PROCESSING_ANSWER');
    try {
      await onSkip();
    } finally {
      setPhase('IDLE');
      // Reset skip flags after processing (will also be reset on question change)
      isManuallySkippingRef.current = false;
    }
  };

  /**
   * Handle manual stop recording
   */
  const handleStopRecording = () => {
    recorder.stopRecording();
  };

  // ============ UI HELPERS ============

  const getPhaseStatusText = (): string => {
    switch (phase) {
      case 'INITIALIZING_TTS':
        return '🚀 Starting Interview...';
      case 'READY_TO_START':
        return '✅ Ready to begin!';
      case 'AI_SPEAKING':
        return '🎙️ Interviewer is speaking...';
      case 'WAITING_TO_RECORD':
        return '⏳ Get ready to answer...';
      case 'RECORDING':
        return '🔴 Listening... Speak now';
      case 'PROCESSING_STT':
        return '🔄 Processing your response...';
      case 'PROCESSING_ANSWER':
        return '💭 AI is thinking...';
      default:
        return '✅ Ready';
    }
  };

  const getPhaseColor = (): string => {
    switch (phase) {
      case 'INITIALIZING_TTS':
        return '#8b5cf6'; // Purple for initialization
      case 'READY_TO_START':
        return '#10b981'; // Green for ready
      case 'AI_SPEAKING':
        return '#3b82f6'; // Blue
      case 'RECORDING':
        return '#ef4444'; // Red
      case 'PROCESSING_STT':
      case 'PROCESSING_ANSWER':
        return '#f59e0b'; // Amber
      default:
        return '#10b981'; // Green
    }
  };

  // ============ RENDER ============

  // Show loading screen while TTS is initializing OR ready to start screen
  if (phase === 'INITIALIZING_TTS' || phase === 'READY_TO_START') {
    const isReady = phase === 'READY_TO_START';
    
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '600px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '2rem',
      }}>
        {/* Animated Logo/Avatar */}
        <div style={{
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: isReady 
            ? 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)' 
            : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '4rem',
          boxShadow: isReady 
            ? '0 0 0 8px rgba(16, 185, 129, 0.3), 0 0 0 16px rgba(16, 185, 129, 0.1)'
            : '0 0 0 8px rgba(139, 92, 246, 0.3), 0 0 0 16px rgba(139, 92, 246, 0.1)',
          animation: 'pulse 2s infinite',
        }}>
          🤖
        </div>
        
        {/* Loading/Ready Text */}
        <div style={{
          color: '#e2e8f0',
          fontSize: '1.5rem',
          fontWeight: '600',
          textAlign: 'center',
        }}>
          {isReady ? 'Ready to Begin!' : 'Preparing Interview...'}
        </div>
        
        {/* Subtitle */}
        <div style={{
          color: '#94a3b8',
          fontSize: '1rem',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          {isReady 
            ? 'Click the button below to start your voice interview' 
            : 'Initializing voice system...'}
        </div>
        
        {/* Loading Animation OR Start Button */}
        {isReady ? (
          <button
            onClick={handleBeginInterview}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.25rem',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              marginTop: '1rem',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 30px rgba(16, 185, 129, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
            }}
          >
            🎤 Begin Interview
          </button>
        ) : (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '1rem',
          }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                width: '12px',
                height: '12px',
                background: '#8b5cf6',
                borderRadius: '50%',
                animation: `bounce 1.4s ease-in-out ${i * 0.1}s infinite`,
              }} />
            ))}
          </div>
        )}
        
        {/* CSS Animations */}
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
            40% { transform: translateY(-15px); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '600px',
      background: '#0f172a',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      
      {/* ========== TOP: AI INTERVIEWER WINDOW ========== */}
      <div style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
        borderBottom: '2px solid #334155',
        position: 'relative',
      }}>
        {/* Progress indicator */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(255,255,255,0.1)',
          padding: '0.5rem 1rem',
          borderRadius: '2rem',
          color: '#94a3b8',
          fontSize: '0.875rem',
        }}>
          Question {session.progress.current} / {session.progress.total}
        </div>

        {/* AI Avatar */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          marginBottom: '1.5rem',
          boxShadow: phase === 'AI_SPEAKING' 
            ? '0 0 0 8px rgba(59, 130, 246, 0.3), 0 0 0 16px rgba(59, 130, 246, 0.1)'
            : '0 10px 40px rgba(0,0,0,0.3)',
          animation: phase === 'AI_SPEAKING' ? 'pulse 2s infinite' : 'none',
          transition: 'box-shadow 0.3s ease',
        }}>
          🤖
        </div>

        {/* AI Name */}
        <div style={{
          color: '#e2e8f0',
          fontSize: '1.25rem',
          fontWeight: '600',
          marginBottom: '0.5rem',
        }}>
          AI Interviewer
        </div>

        {/* Current Question / Last Message */}
        <div style={{
          maxWidth: '80%',
          textAlign: 'center',
          color: '#cbd5e1',
          fontSize: '1.1rem',
          lineHeight: '1.6',
          padding: '1rem 2rem',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          minHeight: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {conversationHistory.length > 0 
            ? conversationHistory.filter(m => m.role === 'interviewer').slice(-1)[0]?.message || 'Starting interview...'
            : session.current_question?.question || 'Starting interview...'
          }
        </div>

        {/* Speaking indicator */}
        {phase === 'AI_SPEAKING' && (
          <div style={{
            display: 'flex',
            gap: '4px',
            marginTop: '1rem',
          }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                width: '4px',
                height: '20px',
                background: '#3b82f6',
                borderRadius: '2px',
                animation: `soundwave 0.5s ease-in-out ${i * 0.1}s infinite alternate`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ========== BOTTOM: USER CAMERA WINDOW ========== */}
      <div style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
        background: '#1e293b',
      }}>
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          flex: 1,
        }}>
          
          {/* Camera View */}
          <div style={{
            flex: '0 0 320px',
            position: 'relative',
          }}>
            <div style={{
              aspectRatio: '4/3',
              background: '#0f172a',
              borderRadius: '12px',
              overflow: 'hidden',
              border: phase === 'RECORDING' 
                ? '3px solid #ef4444' 
                : '3px solid #334155',
              transition: 'border-color 0.3s ease',
            }}>
              {cameraError ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  padding: '1rem',
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</span>
                  <span style={{ fontSize: '0.875rem' }}>{cameraError}</span>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)', // Mirror the video
                  }}
                />
              )}
            </div>

            {/* Recording indicator */}
            {phase === 'RECORDING' && (
              <div style={{
                position: 'absolute',
                top: '0.75rem',
                left: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '2rem',
                fontSize: '0.75rem',
                fontWeight: '600',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  background: 'white',
                  borderRadius: '50%',
                  animation: 'blink 1s infinite',
                }} />
                REC
              </div>
            )}

            {/* Silence Warning Countdown Overlay */}
            {showSkipWarning && silenceCountdown !== null && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                zIndex: 10,
              }}>
                {/* Warning Icon */}
                <div style={{
                  fontSize: '2.5rem',
                  marginBottom: '0.75rem',
                  animation: 'pulse 1s infinite',
                }}>
                  ⏱️
                </div>
                
                {/* Countdown Number */}
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  color: '#fbbf24',
                  marginBottom: '0.5rem',
                  animation: 'countdownPulse 1s infinite',
                }}>
                  {silenceCountdown}
                </div>
                
                {/* Warning Text */}
                <div style={{
                  color: '#f87171',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  textAlign: 'center',
                  padding: '0 1rem',
                }}>
                  No response detected
                </div>
                <div style={{
                  color: '#94a3b8',
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  marginTop: '0.25rem',
                }}>
                  Skipping in {silenceCountdown}s... Speak to cancel
                </div>
              </div>
            )}

            {/* User name */}
            <div style={{
              position: 'absolute',
              bottom: '0.75rem',
              left: '0.75rem',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              You
            </div>
          </div>

          {/* Status & Controls Panel */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            
            {/* Status */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              padding: '1rem 1.5rem',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.75rem',
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  background: getPhaseColor(),
                  borderRadius: '50%',
                  animation: phase === 'RECORDING' ? 'pulse 1s infinite' : 'none',
                }} />
                <span style={{
                  color: '#e2e8f0',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}>
                  {getPhaseStatusText()}
                </span>
              </div>

              {/* Audio Level Indicator */}
              {phase === 'RECORDING' && (
                <div style={{
                  height: '8px',
                  background: '#374151',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${recorder.audioLevel}%`,
                    background: recorder.audioLevel > 50 ? '#10b981' : '#3b82f6',
                    transition: 'width 0.1s ease',
                  }} />
                </div>
              )}

              {/* Transcript Preview */}
              {transcript && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '0.875rem',
                  fontStyle: 'italic',
                }}>
                  "{transcript}"
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}>
                  <span>⚠️ {error}</span>
                  {phase === 'IDLE' && (
                    <button
                      onClick={() => {
                        setError(null);
                        startListening();
                      }}
                      style={{
                        padding: '0.375rem 0.75rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🎤 Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div style={{
              color: '#64748b',
              fontSize: '0.875rem',
              lineHeight: '1.6',
            }}>
              💡 <strong>Tips:</strong> Speak clearly and naturally. 
              Recording will stop automatically after 1.5 seconds of silence.
              You can also click "Stop" to finish your answer early.
            </div>

            {/* Control Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginTop: 'auto',
            }}>
              {/* Start Recording Button - shows when IDLE and no recording */}
              {phase === 'IDLE' && !error && (
                <button
                  onClick={() => {
                    setError(null);
                    startListening();
                  }}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1.5rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  🎤 Start Recording
                </button>
              )}

              {/* Stop Recording Button */}
              {phase === 'RECORDING' && (
                <button
                  onClick={handleStopRecording}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1.5rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  ⏹️ Stop Recording
                </button>
              )}

              {/* Skip Button */}
              <button
                onClick={handleSkip}
                disabled={phase === 'PROCESSING_STT' || phase === 'PROCESSING_ANSWER' || isLoading}
                style={{
                  flex: 1,
                  padding: '0.875rem 1.5rem',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '2px solid #475569',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: (phase === 'PROCESSING_STT' || phase === 'PROCESSING_ANSWER' || isLoading) 
                    ? 'not-allowed' : 'pointer',
                  opacity: (phase === 'PROCESSING_STT' || phase === 'PROCESSING_ANSWER' || isLoading) 
                    ? 0.5 : 1,
                }}
              >
                ⏭️ Skip Question
              </button>

              {/* End Interview Button */}
              <button
                onClick={onEndInterview}
                disabled={isLoading}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: 'transparent',
                  color: '#f87171',
                  border: '2px solid #7f1d1d',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                End Interview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes soundwave {
          from { height: 10px; }
          to { height: 25px; }
        }
        @keyframes countdownPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default VoiceInterview;
