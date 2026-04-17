/**
 * VoiceInterview - Two-window voice-based interview component
 * 
 * Layout:
 * â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
 * â”‚              AI INTERVIEWER WINDOW                         â”‚
 * â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                         â”‚
 * â”‚  â”‚   ðŸ¤– Avatar  â”‚  "Tell me about your experience..."     â”‚
 * â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                         â”‚
 * â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
 * â”‚                USER CAMERA WINDOW                          â”‚
 * â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    Status: Listening...                 â”‚
 * â”‚  â”‚   ðŸ‘¤ Video   â”‚    [Audio Level Indicator]              â”‚
 * â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    [Skip] [End Interview]               â”‚
 * â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 * 
 * Flow:
 * 1. AI speaks question (TTS)
 * 2. Mic auto-opens when TTS ends
 * 3. User answers by voice
 * 4. Silence detection stops recording
 * 5. Audio sent to backend for STT
 * 6. Transcript sent to existing interview logic
 * 7. AI responds â†’ Repeat
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
  const cameraStreamRef = useRef<MediaStream | null>(null);  // Ref for camera cleanup on unmount
  const hasSpokenCurrentQuestion = useRef(false);
  const hasUserSpokenThisRecording = useRef(false);  // Track if user spoke during current recording
  const recordingStartTimeRef = useRef<number | null>(null);  // When recording started
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);  // Timer for 7s silence detection
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);  // Timer for 3-2-1 countdown
  const isAutoSkippingRef = useRef(false);  // Prevent race conditions during auto-skip
  const currentQuestionIdRef = useRef<number | null>(null);  // Track current question to detect changes
  const isTTSSpeakingRef = useRef(false);  // CRITICAL: Prevent recording while TTS is speaking
  const skipInProgressRef = useRef(false);  // Prevent double-skip from manual skip button
  const emptyTranscriptCountRef = useRef(0);  // Track consecutive empty transcripts

  // ============ HOOKS ============
  
  // Text-to-Speech for AI interviewer
  const tts = useTextToSpeech({
    onStart: () => {
      isTTSSpeakingRef.current = true;  // Mark TTS as speaking
      setPhase('AI_SPEAKING');
      console.log('');
    },
    onEnd: () => {
      console.log('');
      isTTSSpeakingRef.current = false;  // Mark TTS as done
      // Longer pause before opening mic (2s feels more natural and prevents audio overlap)
      setPhase('WAITING_TO_RECORD');
      setTimeout(() => {
        // Double-check all flags before starting recording
        if (!isTTSSpeakingRef.current && !isAutoSkippingRef.current && !skipInProgressRef.current) {
          startListening();
        }
      }, 2000);  // Increased from 800ms to 2000ms
    },
    onError: (err) => {
      console.error('TTS Error:', err);
      isTTSSpeakingRef.current = false;
      // If TTS fails, still allow recording after delay
      setPhase('WAITING_TO_RECORD');
      setTimeout(() => {
        if (!isTTSSpeakingRef.current && !isAutoSkippingRef.current && !skipInProgressRef.current) {
          startListening();
        }
      }, 1000);
    },
  });

  // Voice recorder with silence detection
  const recorder = useVoiceRecorder({
    silenceDuration: 2500, // 2.5 seconds of silence to stop (increased from 1.5 for more natural pauses)
    autoStopOnSilence: true,
    onSilenceDetected: () => {
      console.log('');
    },
    onRecordingComplete: async (blob) => {
      console.log('', blob.size, 'bytes');
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
        console.log('');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false, // Audio handled separately by recorder
        });
        
        console.log('');
        setCameraStream(stream);
        cameraStreamRef.current = stream;  // Store in ref for cleanup
        
        if (videoRef.current) {
          console.log('');
          videoRef.current.srcObject = stream;
        } else {
          console.log('');
        }
      } catch (err) {
        console.error('', err);
        setCameraError('Could not access camera. Please ensure camera permissions are granted.');
      }
    };

    initCamera();

    // Cleanup camera on unmount - use ref since state is stale in cleanup
    return () => {
      console.log('');
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('', track.kind);
        });
        cameraStreamRef.current = null;
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
          console.log('');
          videoRef.current.srcObject = cameraStream;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, cameraStream]);

  // Track question change cooldown to prevent immediate auto-skip
  const questionChangedTimeRef = useRef<number | null>(null);
  
  // Reset spoken flag when question changes (allow new question to be spoken)
  useEffect(() => {
    if (session.current_question) {
      const newQuestionId = session.current_question.id;
      
      // Check if question actually changed
      if (currentQuestionIdRef.current !== newQuestionId) {
        console.log('', currentQuestionIdRef.current, 'â†’', newQuestionId);
        currentQuestionIdRef.current = newQuestionId;
        
        // Mark time of question change for cooldown
        questionChangedTimeRef.current = Date.now();
        
        // Reset state for new question - CRITICAL for preventing bugs
        // NOTE: Do NOT reset isTTSSpeakingRef here - it will be set by speakInterviewerMessage
        // and the TTS onStart/onEnd callbacks will manage it. Resetting here causes race conditions.
        isAutoSkippingRef.current = false;
        skipInProgressRef.current = false;
        hasUserSpokenThisRecording.current = false;
        recordingStartTimeRef.current = null;
        emptyTranscriptCountRef.current = 0;  // Reset empty transcript counter
        
        // Clear any pending timers IMMEDIATELY
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
        
        console.log('âœ… State and timers reset for new question');
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
   * CRITICAL: Sets isTTSSpeakingRef BEFORE calling speak to prevent race conditions
   */
  const speakInterviewerMessage = useCallback((message: string) => {
    if (message === lastSpokenMessage) return;
    if (!message || message.trim().length === 0) return;
    
    console.log('', message.substring(0, 50) + '...');
    
    // CRITICAL: Set TTS speaking flag BEFORE calling speak()
    // This prevents recording from starting in the race window before onStart callback
    isTTSSpeakingRef.current = true;
    setPhase('AI_SPEAKING');
    
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
      console.log('â³ Waiting for TTS to initialize...');
      return;
    }
    
    // Get first interviewer message
    const firstInterviewerMessage = conversationHistory.find(
      msg => msg.role === 'interviewer'
    );
    
    // Wait for conversation history to have the first question
    if (!firstInterviewerMessage?.message) {
      console.log('â³ Waiting for first question...');
      return;
    }
    
    // ALL CONDITIONS MET - Show "Begin Interview" button
    console.log('âœ… TTS Ready + Question Available - Ready to start!');
    setPhase('READY_TO_START');
    
  }, [phase, tts.isReady, conversationHistory]);

  /**
   * Handle user clicking "Begin Interview" button
   * This provides the user gesture needed for TTS to work in browsers
   */
  const handleBeginInterview = useCallback(() => {
    console.log('');
    
    // Get first interviewer message
    const firstInterviewerMessage = conversationHistory.find(
      msg => msg.role === 'interviewer'
    );
    
    if (!firstInterviewerMessage?.message) {
      console.error('No first question found!');
      return;
    }
    
    console.log('');
    console.log('', firstInterviewerMessage.message.substring(0, 50) + '...');
    
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
      console.log('â¸ï¸ Skipping auto-speak - still in init phase:', phase);
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
  
  // Constants for silence detection - TUNED TO USER'S REQUIREMENTS
  const EXTENDED_SILENCE_THRESHOLD = 7000;  // 7 seconds of silence before warning
  const SPEECH_THRESHOLD = 8;  // Audio level above this = user is speaking (lowered for better sensitivity)
  const COUNTDOWN_SECONDS = 3;  // 3-2-1 countdown before skip
  const QUESTION_CHANGE_COOLDOWN = 5000;  // 5s grace period after question change (for TTS + think time)
  const MAX_EMPTY_TRANSCRIPTS = 2;  // Skip after this many consecutive empty transcripts
  
  /**
   * Clear all silence-related timers
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
    setSilenceCountdown(null);
    setShowSkipWarning(false);
  }, []);

  /**
   * Start listening for user's voice answer
   * CRITICAL: Only starts if TTS is not speaking and no skip in progress
   */
  const startListening = useCallback(() => {
    // CRITICAL: Don't start recording if TTS is still speaking
    if (isTTSSpeakingRef.current) {
      console.log('âš ï¸ Cannot start recording - TTS is still speaking');
      return;
    }
    
    // Don't start if auto-skipping
    if (isAutoSkippingRef.current) {
      console.log('âš ï¸ Cannot start recording - auto-skip in progress');
      return;
    }
    
    // Don't start if manual skip in progress
    if (skipInProgressRef.current) {
      console.log('âš ï¸ Cannot start recording - manual skip in progress');
      return;
    }
    
    // Reset silence tracking for new recording
    hasUserSpokenThisRecording.current = false;
    recordingStartTimeRef.current = Date.now();
    clearSilenceTimers();
    
    setPhase('RECORDING');
    setTranscript('');
    recorder.startRecording();
    
    console.log('');
  }, [recorder, clearSilenceTimers]);

  /**
   * Handle auto-skip when countdown reaches 0
   */
  const handleAutoSkip = useCallback(async () => {
    // Prevent double-skip
    if (isAutoSkippingRef.current) {
      console.log('âš ï¸ Already auto-skipping, ignoring');
      return;
    }
    
    // Additional safety check: don't auto-skip if question just changed
    const timeSinceQuestionChange = Date.now() - (questionChangedTimeRef.current || 0);
    if (timeSinceQuestionChange < QUESTION_CHANGE_COOLDOWN) {
      console.log('âš ï¸ Question just changed, aborting auto-skip');
      clearSilenceTimers();
      return;
    }
    
    console.log('â­ï¸ Auto-skipping question due to extended silence');
    isAutoSkippingRef.current = true;  // Set flag to prevent recording callback from processing
    
    // CRITICAL: Also set TTS flag to prevent any recording from starting
    // during the transition to the next question
    isTTSSpeakingRef.current = true;
    
    clearSilenceTimers();
    recorder.stopRecording();
    
    // Small delay to ensure recording is fully stopped, then skip
    setTimeout(async () => {
      await onSkip();
      // isAutoSkippingRef will be reset when new question arrives
    }, 300);  // Increased delay for stability
  }, [clearSilenceTimers, recorder, onSkip]);

  /**
   * Start the 3-2-1 countdown before auto-skip
   */
  const startSkipCountdown = useCallback(() => {
    console.log('âš ï¸ Starting skip countdown');
    setShowSkipWarning(true);
    setSilenceCountdown(COUNTDOWN_SECONDS);
    
    let count = COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      console.log(`â³ Countdown: ${count}`);
      
      if (count <= 0) {
        // Countdown finished - auto skip
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        handleAutoSkip();
      } else {
        setSilenceCountdown(count);
      }
    }, 1000);
  }, [handleAutoSkip]);

  /**
   * Monitor audio level during recording for silence/speech detection
   * This runs on every audioLevel change to detect when user is speaking
   */
  useEffect(() => {
    // Only run during RECORDING phase
    if (phase !== 'RECORDING') {
      return;
    }

    const audioLevel = recorder.audioLevel;
    const isUserSpeaking = audioLevel > SPEECH_THRESHOLD;

    // User is speaking - cancel any pending skip
    if (isUserSpeaking) {
      if (!hasUserSpokenThisRecording.current) {
        console.log('', audioLevel);
        hasUserSpokenThisRecording.current = true;
      }
      
      // Cancel countdown if user speaks during it
      if (showSkipWarning || silenceCountdown !== null) {
        console.log('âœ… User spoke - cancelling skip countdown');
        clearSilenceTimers();
      }
      
      // Reset the silence timer since user is speaking
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  }, [phase, recorder.audioLevel, showSkipWarning, silenceCountdown, clearSilenceTimers]);

  /**
   * Periodic silence check - runs every second during recording
   * This ensures silence detection works even if audioLevel doesn't change
   */
  useEffect(() => {
    if (phase !== 'RECORDING') {
      return;
    }

    const silenceCheckInterval = setInterval(() => {
      // Skip if already showing warning or in countdown
      if (showSkipWarning || silenceCountdown !== null) {
        return;
      }
      
      // Skip if still in cooldown period after question change
      const timeSinceQuestionChange = Date.now() - (questionChangedTimeRef.current || 0);
      if (timeSinceQuestionChange < QUESTION_CHANGE_COOLDOWN) {
        return;
      }
      
      const timeSinceRecordingStart = Date.now() - (recordingStartTimeRef.current || Date.now());
      const currentAudioLevel = recorder.audioLevel;
      const isCurrentlySilent = currentAudioLevel <= SPEECH_THRESHOLD;
      
      // Check if user never spoke and recording has been going long enough
      if (!hasUserSpokenThisRecording.current && timeSinceRecordingStart >= EXTENDED_SILENCE_THRESHOLD) {
        console.log('');
        startSkipCountdown();
        return;
      }
      
      // Check if user spoke before but now silent for extended period
      if (hasUserSpokenThisRecording.current && isCurrentlySilent && !silenceTimerRef.current) {
        console.log('');
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null;
          console.log('');
          startSkipCountdown();
        }, EXTENDED_SILENCE_THRESHOLD);
      }
    }, 1000);  // Check every second

    return () => clearInterval(silenceCheckInterval);
  }, [phase, showSkipWarning, silenceCountdown, recorder.audioLevel, startSkipCountdown]);

  // Clear timers when phase changes away from RECORDING
  useEffect(() => {
    if (phase !== 'RECORDING') {
      clearSilenceTimers();
    }
  }, [phase, clearSilenceTimers]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimers();
    };
  }, [clearSilenceTimers]);

  /**
   * Handle completed recording - send to STT backend
   */
  const handleRecordingComplete = async (audioBlob: Blob) => {
    // CRITICAL: Check if skip/auto-skip is in progress - discard recording
    // This prevents partial answers from being applied to the next question
    if (isAutoSkippingRef.current || skipInProgressRef.current) {
      console.log('â­ï¸ Recording completed during skip, discarding audio');
      return;
    }
    
    setPhase('PROCESSING_STT');
    setError(null);
    
    try {
      // Validate blob - allow smaller blobs as speech can be short
      if (!audioBlob || audioBlob.size < 500) {
        console.warn('Audio blob too small:', audioBlob?.size);
        setError('Recording too short. Please speak and hold.');
        setPhase('IDLE');
        // Restart recording after delay, but check flags first
        setTimeout(() => {
          if (!isAutoSkippingRef.current && !isTTSSpeakingRef.current && !skipInProgressRef.current) {
            startListening();
          }
        }, 2000);
        return;
      }

      console.log('', audioBlob.size, 'bytes, type:', audioBlob.type);

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

      // CRITICAL: Re-check skip flags after async operation
      // User might have pressed skip while STT was processing
      if (isAutoSkippingRef.current || skipInProgressRef.current) {
        console.log('â­ï¸ Skip pressed during STT processing, discarding transcript');
        setPhase('IDLE');
        return;
      }

      if (result.success && result.transcript) {
        const transcribedText = result.transcript.trim();
        setTranscript(transcribedText);

        if (transcribedText.length > 0) {
          console.log('', transcribedText);
          // Reset empty counter on successful speech
          emptyTranscriptCountRef.current = 0;
          setPhase('PROCESSING_ANSWER');
          
          // Final check before submitting - user might skip at the last moment
          if (isAutoSkippingRef.current || skipInProgressRef.current) {
            console.log('â­ï¸ Skip pressed before answer submit, discarding');
            setPhase('IDLE');
            return;
          }
          
          // Pass transcript to existing interview logic
          await onAnswerSubmit(transcribedText);
          setPhase('IDLE');
        } else {
          // Empty transcript - maybe user didn't speak
          emptyTranscriptCountRef.current += 1;
          console.log(`âš ï¸ Empty transcript #${emptyTranscriptCountRef.current}/${MAX_EMPTY_TRANSCRIPTS}`);
          
          // Auto-skip after too many empty transcripts
          if (emptyTranscriptCountRef.current >= MAX_EMPTY_TRANSCRIPTS) {
            console.log('â­ï¸ Too many empty transcripts, auto-skipping...');
            emptyTranscriptCountRef.current = 0;
            handleAutoSkip();
            return;
          }
          
          setError('No speech detected. Please speak clearly.');
          setPhase('IDLE');
          // Restart recording after delay, but check flags first
          setTimeout(() => {
            if (!isAutoSkippingRef.current && !isTTSSpeakingRef.current && !skipInProgressRef.current) {
              startListening();
            }
          }, 3000);  // 3 second delay
        }
      } else {
        // STT returned but no transcript
        const errorMsg = result.detail || result.error || 'Could not recognize speech';
        console.warn('STT returned no transcript:', result);
        emptyTranscriptCountRef.current += 1;
        
        if (emptyTranscriptCountRef.current >= MAX_EMPTY_TRANSCRIPTS) {
          console.log('â­ï¸ Too many failed transcripts, auto-skipping...');
          emptyTranscriptCountRef.current = 0;
          handleAutoSkip();
          return;
        }
        
        setError(`${errorMsg}. Please speak clearly and try again.`);
        setPhase('IDLE');
        // Restart recording after delay, but check flags first
        setTimeout(() => {
          if (!isAutoSkippingRef.current && !isTTSSpeakingRef.current && !skipInProgressRef.current) {
            startListening();
          }
        }, 3000);  // 3 second delay
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
   * CRITICAL: Prevents double-skip with flag and prevents recording during transition
   */
  const handleSkip = async () => {
    // Prevent double-skip
    if (skipInProgressRef.current || isAutoSkippingRef.current) {
      console.log('âš ï¸ Skip already in progress, ignoring');
      return;
    }
    
    console.log('â­ï¸ Manual skip triggered - stopping all recording');
    
    // CRITICAL: Set ALL skip flags BEFORE stopping recording
    // This ensures handleRecordingComplete will discard any pending audio
    skipInProgressRef.current = true;
    isAutoSkippingRef.current = true;  // Also set this for extra safety
    isTTSSpeakingRef.current = true;   // Prevent new recordings from starting
    
    // Stop any ongoing processes - this may trigger onRecordingComplete
    // but the flags above will cause it to discard the audio
    recorder.stopRecording();
    tts.stop();
    clearSilenceTimers();
    
    // Reset state
    setTranscript('');
    setError(null);
    hasSpokenCurrentQuestion.current = false;
    
    setPhase('PROCESSING_ANSWER');
    try {
      await onSkip();
    } finally {
      setPhase('IDLE');
      // NOTE: Skip flags will be reset when new question arrives (in question change effect)
      // This ensures flags stay set until the new question is fully loaded
    }
  };

  /**
   * Handle manual stop recording
   */
  const handleStopRecording = () => {
    recorder.stopRecording();
  };

  /**
   * Properly end the interview with full cleanup
   * Stops camera, mic, TTS, and all timers before calling onEndInterview
   */
  const handleEndInterview = useCallback(() => {
    console.log('');
    
    // CRITICAL: Set flags BEFORE stopping recording to discard any pending audio
    // Don't reset them - the component will unmount anyway
    isTTSSpeakingRef.current = true;
    isAutoSkippingRef.current = true;
    skipInProgressRef.current = true;
    
    // Stop all processes
    recorder.stopRecording();
    tts.stop();
    clearSilenceTimers();
    
    // Stop camera - use both state and ref to ensure we get it
    const streamToStop = cameraStreamRef.current || cameraStream;
    if (streamToStop) {
      console.log('');
      streamToStop.getTracks().forEach(track => {
        track.stop();
        console.log('', track.kind);
      });
      cameraStreamRef.current = null;
    }
    
    // Clear any pending timeouts that might restart recording
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    
    // Reset phase and state
    setPhase('IDLE');
    setError(null);
    setTranscript('');
    setSilenceCountdown(null);
    setShowSkipWarning(false);
    
    console.log('âœ… Cleanup complete - calling onEndInterview');
    
    // Call the parent's end interview handler
    onEndInterview();
  }, [recorder, tts, clearSilenceTimers, cameraStream, onEndInterview]);

  // ============ UI HELPERS ============

  const getPhaseStatusText = (): string => {
    switch (phase) {
      case 'INITIALIZING_TTS':   return 'Starting Interview...';
      case 'READY_TO_START':     return 'Ready to begin';
      case 'AI_SPEAKING':        return 'Interviewer is speaking...';
      case 'WAITING_TO_RECORD':  return 'Get ready to answer...';
      case 'RECORDING':          return 'Listening - Speak now';
      case 'PROCESSING_STT':     return 'Processing response...';
      case 'PROCESSING_ANSWER':  return 'AI is thinking...';
      default:                   return 'Ready';
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

  // ============ RENDER ============

  // PRE-START screen
  if (phase === 'INITIALIZING_TTS' || phase === 'READY_TO_START') {
    const isReady = phase === 'READY_TO_START';
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg,#0a0f1e 0%,#0f2044 50%,#0a0f1e 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '2rem',
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: isReady ? 'rgba(16,185,129,.08)' : 'rgba(59,130,246,.08)',
          filter: 'blur(80px)', pointerEvents: 'none' }} />

        {/* AI avatar circle */}
        <div style={{
          width: 140, height: 140, borderRadius: '50%',
          background: isReady ? 'linear-gradient(135deg,#10b981,#3b82f6)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isReady
            ? '0 0 0 14px rgba(16,185,129,.18),0 0 0 28px rgba(16,185,129,.06)'
            : '0 0 0 14px rgba(139,92,246,.18),0 0 0 28px rgba(139,92,246,.06)',
          animation: 'viAvatarPulse 2.4s ease-in-out infinite',
          position: 'relative', zIndex: 1,
        }}>
          {/* AI icon as SVG — no emoji */}
          <svg width="56" height="56" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ color: '#f1f5f9', fontSize: '1.75rem', fontWeight: 700, marginBottom: '.5rem' }}>
            {isReady ? 'Ready to Begin!' : 'Setting Up Interview...'}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '1rem' }}>
            {isReady
              ? 'Camera and mic will be requested when you click Start'
              : 'Initializing voice system and loading your question...'}
          </div>
        </div>

        {isReady ? (
          <button
            onClick={handleBeginInterview}
            style={{
              display: 'flex', alignItems: 'center', gap: '.625rem',
              padding: '1.1rem 3.5rem', fontSize: '1.1rem', fontWeight: 700,
              background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white',
              border: 'none', borderRadius: '14px', cursor: 'pointer',
              boxShadow: '0 6px 28px rgba(16,185,129,.4)', transition: 'all .2s',
              position: 'relative', zIndex: 1,
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            Start Interview
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{
                width: 10, height: 10, background: '#8b5cf6', borderRadius: '50%',
                animation: `viDotBounce 1.4s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}

        <style>{`
          @keyframes viAvatarPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
          @keyframes viDotBounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-14px);opacity:1} }
        `}</style>
      </div>
    );
  }

  // MAIN INTERVIEW ROOM — fullscreen
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#080d1a',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>

      {/* TOP BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '.875rem 1.75rem', borderBottom: '1px solid #1e293b',
        background: 'rgba(15,23,42,.95)', backdropFilter: 'blur(12px)', flexShrink: 0,
      }}>
        {/* Left: LIVE badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.4rem',
            background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)',
            borderRadius: 999, padding: '.25rem .75rem',
          }}>
            <div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%', animation: 'viLiveBlink 1s infinite' }} />
            <span style={{ color: '#fca5a5', fontSize: '.75rem', fontWeight: 700, letterSpacing: '.08em' }}>LIVE</span>
          </div>
          <span style={{ color: '#64748b', fontSize: '.875rem' }}>AI Mock Interview</span>
        </div>

        {/* Center: progress dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            {Array.from({ length: session.progress.total }, (_, i) => (
              <div key={i} style={{
                width: 28, height: 4, borderRadius: 2,
                background: i < session.progress.current
                  ? '#3b82f6'
                  : i === session.progress.current - 1
                  ? '#10b981'
                  : '#1e293b',
                transition: 'background .4s',
              }} />
            ))}
          </div>
          <span style={{ color: '#64748b', fontSize: '.8rem', whiteSpace: 'nowrap' }}>
            Q {session.progress.current} / {session.progress.total}
          </span>
        </div>

        {/* Right: phase status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '.5rem',
          padding: '.3rem .875rem', borderRadius: 999,
          background: `${getPhaseColor()}22`, border: `1px solid ${getPhaseColor()}55`,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: getPhaseColor(),
            animation: phase === 'RECORDING' ? 'viLiveBlink .8s infinite' : 'none',
          }} />
          <span style={{ color: getPhaseColor(), fontSize: '.75rem', fontWeight: 600 }}>
            {getPhaseStatusText()}
          </span>
        </div>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>

        {/* LEFT — AI PANEL */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: '2.5rem', background: 'linear-gradient(160deg,#0f1e3d,#0a0f1e)',
          position: 'relative', overflow: 'hidden', borderRight: '1px solid #1e293b',
        }}>
          {/* glow */}
          <div style={{
            position: 'absolute', width: 480, height: 480, borderRadius: '50%',
            background: phase === 'AI_SPEAKING'
              ? 'radial-gradient(circle,rgba(59,130,246,.12) 0%,transparent 70%)'
              : 'radial-gradient(circle,rgba(30,58,138,.07) 0%,transparent 70%)',
            pointerEvents: 'none', transition: 'background 1s',
          }} />

          {/* AI avatar */}
          <div style={{
            width: 130, height: 130, borderRadius: '50%',
            background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.75rem', position: 'relative', zIndex: 1,
            boxShadow: phase === 'AI_SPEAKING'
              ? '0 0 0 12px rgba(59,130,246,.2),0 0 0 24px rgba(59,130,246,.08),0 20px 60px rgba(59,130,246,.3)'
              : '0 16px 50px rgba(0,0,0,.4)',
            animation: phase === 'AI_SPEAKING' ? 'viAiPulse 1.5s ease-in-out infinite' : 'none',
            transition: 'box-shadow .5s',
          }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>

          <div style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: 700, marginBottom: '.35rem', zIndex: 1, position: 'relative' }}>
            AI Interviewer
          </div>
          <div style={{ color: '#475569', fontSize: '.8rem', marginBottom: '2rem', zIndex: 1, position: 'relative' }}>
            Powered by InterviewAI
          </div>

          {/* Sound wave while AI speaks */}
          {phase === 'AI_SPEAKING' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '1.5rem', zIndex: 1, position: 'relative' }}>
              {[0,1,2,3,4,5,6].map(i => (
                <div key={i} style={{
                  width: 4, borderRadius: 3, background: '#3b82f6',
                  animation: `viSoundBar .7s ease-in-out ${i * 0.09}s infinite alternate`,
                  height: 14 + (i % 3) * 8,
                }} />
              ))}
            </div>
          )}

          {/* Question bubble */}
          <div style={{
            maxWidth: 680, width: '100%',
            background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.08)', borderRadius: 16,
            padding: '1.5rem 2rem', position: 'relative', zIndex: 1,
          }}>
            <div style={{
              color: '#94a3b8', fontSize: '.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.75rem',
              display: 'flex', alignItems: 'center', gap: '.4rem',
            }}>
              {phase === 'AI_SPEAKING' ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#3b82f6">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                  </svg>
                  <span style={{ color: '#60a5fa' }}>Speaking...</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#94a3b8">
                    <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
                  </svg>
                  Current Question
                </>
              )}
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '1.1rem', lineHeight: 1.65, margin: 0 }}>
              {conversationHistory.length > 0
                ? conversationHistory.filter(m => m.role === 'interviewer').slice(-1)[0]?.message || 'Starting interview...'
                : session.current_question?.question || 'Starting interview...'}
            </p>
          </div>

          {/* Transcript */}
          {transcript && (
            <div style={{
              marginTop: '1.25rem', maxWidth: 680, width: '100%',
              background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)',
              borderRadius: 10, padding: '.875rem 1.25rem', position: 'relative', zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.4rem' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#6ee7b7">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 0h-2c0 2.76-2.24 5-5 5S6 7.76 6 5H4c0 3.53 2.61 6.43 6 6.92V21h2v-9.08c3.39-.49 6-3.39 6-6.92z"/>
                </svg>
                <span style={{ color: '#6ee7b7', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Your Answer
                </span>
              </div>
              <p style={{ color: '#a7f3d0', fontSize: '.9rem', margin: 0, fontStyle: 'italic' }}>"{transcript}"</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: '1rem', maxWidth: 680, width: '100%',
              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
              borderRadius: 10, padding: '.75rem 1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
              position: 'relative', zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fca5a5">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span style={{ color: '#fca5a5', fontSize: '.875rem' }}>{error}</span>
              </div>
              {phase === 'IDLE' && (
                <button onClick={() => { setError(null); startListening(); }} style={{
                  padding: '.3rem .75rem', background: '#ef4444', color: 'white',
                  border: 'none', borderRadius: 6, fontSize: '.75rem', fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '.3rem',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 0h-2c0 2.76-2.24 5-5 5S6 7.76 6 5H4c0 3.53 2.61 6.43 6 6.92V21h2v-9.08c3.39-.49 6-3.39 6-6.92z"/></svg>
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — USER CAMERA PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0d1526', borderLeft: '1px solid #1e293b' }}>
          {/* Camera */}
          <div style={{ position: 'relative', flex: 1, background: '#050a14', overflow: 'hidden' }}>
            {cameraError ? (
              <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '.75rem', color: '#475569',
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="#475569">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                <span style={{ fontSize: '.875rem', textAlign: 'center', padding: '0 1.5rem', lineHeight: 1.5 }}>
                  {cameraError}
                </span>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            )}

            {/* REC badge */}
            {phase === 'RECORDING' && (
              <div style={{
                position: 'absolute', top: '1rem', left: '1rem',
                display: 'flex', alignItems: 'center', gap: '.4rem',
                background: 'rgba(239,68,68,.9)', color: 'white',
                padding: '.3rem .75rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 700,
              }}>
                <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%', animation: 'viLiveBlink .8s infinite' }} />
                REC
              </div>
            )}

            {/* Processing overlay */}
            {(phase === 'PROCESSING_STT' || phase === 'PROCESSING_ANSWER') && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.75rem',
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 10, height: 10, borderRadius: '50%', background: '#f59e0b',
                      animation: `viDotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                <span style={{ color: '#e2e8f0', fontSize: '.875rem' }}>
                  {phase === 'PROCESSING_STT' ? 'Transcribing...' : 'AI thinking...'}
                </span>
              </div>
            )}

            {/* Silence countdown */}
            {showSkipWarning && silenceCountdown !== null && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,.85)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5,
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#fbbf24" style={{ marginBottom: '.5rem' }}>
                  <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>{silenceCountdown}</div>
                <div style={{ color: '#f87171', fontSize: '.875rem', fontWeight: 700, marginTop: '.5rem' }}>No response</div>
                <div style={{ color: '#94a3b8', fontSize: '.75rem', marginTop: '.25rem' }}>Speak to cancel</div>
              </div>
            )}

            {/* Your name tag */}
            <div style={{
              position: 'absolute', bottom: '.75rem', left: '.75rem',
              background: 'rgba(0,0,0,.75)', color: '#e2e8f0',
              padding: '.25rem .75rem', borderRadius: 4, fontSize: '.8rem', fontWeight: 600,
            }}>You</div>
          </div>

          {/* Audio level */}
          {phase === 'RECORDING' && (
            <div style={{ padding: '.75rem 1rem', background: '#0f1d38', borderTop: '1px solid #1e293b' }}>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', transition: 'width .1s ease', borderRadius: 3,
                  width: `${recorder.audioLevel}%`,
                  background: recorder.audioLevel > 60 ? '#10b981' : recorder.audioLevel > 25 ? '#3b82f6' : '#64748b',
                }} />
              </div>
              <div style={{ color: '#475569', fontSize: '.7rem', marginTop: '.4rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill={recorder.audioLevel > 25 ? '#10b981' : '#64748b'}>
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                </svg>
                {recorder.audioLevel > 25 ? 'Hearing you clearly' : 'Speak louder'}
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={{ padding: '1.25rem', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <div style={{ color: '#475569', fontSize: '.75rem', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '.4rem' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#475569" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              Speak clearly. 2.5s of silence stops recording automatically.
            </div>

            <div style={{ display: 'flex', gap: '.625rem' }}>
              {phase === 'IDLE' && !error && (
                <button onClick={() => { setError(null); startListening(); }} disabled={isLoading} style={{
                  flex: 1, padding: '.75rem', background: '#10b981', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: '.85rem', fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? .5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  Record
                </button>
              )}

              {phase === 'RECORDING' && (
                <button onClick={handleStopRecording} style={{
                  flex: 1, padding: '.75rem', background: '#ef4444', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: '.85rem', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem',
                  animation: 'viStopPulse 1.5s ease infinite',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12"/></svg>
                  Stop
                </button>
              )}

              <button onClick={handleSkip}
                disabled={phase === 'PROCESSING_STT' || phase === 'PROCESSING_ANSWER' || isLoading}
                style={{
                  flex: 1, padding: '.75rem', background: 'transparent', color: '#94a3b8',
                  border: '1.5px solid #334155', borderRadius: 8, fontSize: '.85rem', fontWeight: 600,
                  cursor: (phase === 'PROCESSING_STT' || phase === 'PROCESSING_ANSWER' || isLoading) ? 'not-allowed' : 'pointer',
                  opacity: (phase === 'PROCESSING_STT' || phase === 'PROCESSING_ANSWER' || isLoading) ? .5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem',
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
                Skip
              </button>
            </div>

            <button onClick={handleEndInterview} disabled={isLoading} style={{
              width: '100%', padding: '.75rem',
              background: 'rgba(239,68,68,.1)', color: '#f87171',
              border: '1.5px solid rgba(239,68,68,.3)', borderRadius: 8,
              fontSize: '.875rem', fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? .5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#f87171">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
              End Interview
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes viAiPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes viLiveBlink { 0%,100%{opacity:1} 50%{opacity:.15} }
        @keyframes viSoundBar { from{height:10px} to{height:26px} }
        @keyframes viStopPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
        @keyframes viDotBounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-10px);opacity:1} }
      `}</style>
    </div>
  );
};

export default VoiceInterview;
