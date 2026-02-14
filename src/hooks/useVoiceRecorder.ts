/**
 * useVoiceRecorder - Custom hook for audio recording with silence detection
 * 
 * Architecture Notes:
 * - This is an INTERFACE LAYER only, does NOT contain interview logic
 * - Modular design: can be replaced with any audio capture solution
 * - Uses MediaRecorder API for browser-native audio capture
 * - Implements automatic silence detection to know when user stops speaking
 * 
 * Why these specific settings?
 * - WebM format: Universally supported in modern browsers
 * - Silence threshold of 1.5s: Feels natural, not rushed
 * - Chunk size 250ms: Good balance between responsiveness and performance
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// Configuration constants - easily adjustable
const SILENCE_THRESHOLD = -45;     // dB level below which we consider "silence"
const SILENCE_DURATION = 1500;     // ms of silence before auto-stopping (1.5 seconds)
const AUDIO_SAMPLE_RATE = 16000;   // 16kHz - optimal for speech recognition
const ANALYSIS_INTERVAL = 100;     // How often to check for silence (ms)
const MIN_RECORDING_DURATION = 1000; // Minimum recording time (ms) to ensure valid webm

interface UseVoiceRecorderOptions {
  onSilenceDetected?: () => void;      // Called when silence is detected
  onRecordingComplete?: (blob: Blob) => void;  // Called with final audio blob
  onError?: (error: string) => void;   // Called on any error
  silenceDuration?: number;            // Override default silence duration
  autoStopOnSilence?: boolean;         // Whether to auto-stop on silence
}

interface UseVoiceRecorderReturn {
  // State
  isRecording: boolean;
  isProcessing: boolean;
  audioBlob: Blob | null;
  error: string | null;
  audioLevel: number;  // Current audio level (0-100) for visual feedback
  
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

export const useVoiceRecorder = (options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn => {
  const {
    onSilenceDetected,
    onRecordingComplete,
    onError,
    silenceDuration = SILENCE_DURATION,
    autoStopOnSilence = true,
  } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs for cleanup and persistence across renders
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceStartRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number | null>(null);  // Track when recording started
  const animationFrameRef = useRef<number | null>(null);
  const analysisIntervalRef = useRef<number | null>(null);

  /**
   * Clean up all audio resources
   * Called on unmount and when stopping recording
   */
  const cleanup = useCallback(() => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear analysis interval
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Stop all audio tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /**
   * Calculate audio level from analyser data
   * Returns a value from 0-100 representing volume
   */
  const getAudioLevel = useCallback((): number => {
    if (!analyserRef.current) return 0;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const sum = dataArray.reduce((acc, val) => acc + val, 0);
    const average = sum / dataArray.length;

    // Normalize to 0-100
    return Math.min(100, Math.round((average / 255) * 100 * 2));
  }, []);

  /**
   * Check if current audio level indicates silence
   * Uses dB calculation for more accurate silence detection
   */
  const isSilent = useCallback((): boolean => {
    if (!analyserRef.current) return false;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // Calculate RMS (Root Mean Square) for volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Convert to dB
    const db = 20 * Math.log10(rms + 0.0001);

    return db < SILENCE_THRESHOLD;
  }, []);

  /**
   * Start recording audio from microphone
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];
      silenceStartRef.current = null;
      recordingStartRef.current = null;

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording');
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,      // Reduce echo
          noiseSuppression: true,      // Reduce background noise
          autoGainControl: true,       // Normalize volume
          sampleRate: AUDIO_SAMPLE_RATE,
        },
      });

      audioStreamRef.current = stream;

      // Set up audio analysis for silence detection
      const audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      // Use webm format - best browser support for audio
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,  // 128kbps - good quality for speech
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks - request data periodically for silence detection
      // but DON'T use timeslice in start() as it corrupts webm headers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        setIsProcessing(true);

        // Combine chunks into single blob
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('🎤 Created audio blob:', blob.size, 'bytes, type:', blob.type);
        setAudioBlob(blob);
        
        // Trigger callback
        if (onRecordingComplete) {
          onRecordingComplete(blob);
        }

        setIsProcessing(false);
        cleanup();
      };

      // Handle errors
      mediaRecorder.onerror = () => {
        const errorMessage = 'Recording error occurred';
        setError(errorMessage);
        if (onError) onError(errorMessage);
        cleanup();
      };

      // Start recording WITHOUT timeslice - this ensures valid webm structure
      // We'll request data manually for progress tracking
      mediaRecorder.start();
      recordingStartRef.current = Date.now();  // Track when we started
      setIsRecording(true);
      console.log('🎤 Recording started');

      // Start silence detection loop
      const checkSilence = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

        // Update audio level for visual feedback
        const level = getAudioLevel();
        setAudioLevel(level);

        // Check for silence (but only after minimum recording duration)
        if (autoStopOnSilence) {
          const recordingDuration = Date.now() - (recordingStartRef.current || Date.now());
          
          // Only check for silence after minimum duration
          if (recordingDuration < MIN_RECORDING_DURATION) {
            return; // Keep recording, haven't reached minimum
          }
          
          if (isSilent()) {
            if (!silenceStartRef.current) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current >= silenceDuration) {
              // Silence duration exceeded - stop recording
              console.log('🔇 Silence detected - stopping recording after', recordingDuration, 'ms');
              if (onSilenceDetected) onSilenceDetected();
              stopRecording();
              return;
            }
          } else {
            // Reset silence timer when sound detected
            silenceStartRef.current = null;
          }
        }
      };

      // Run silence check at regular intervals
      analysisIntervalRef.current = window.setInterval(checkSilence, ANALYSIS_INTERVAL);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      if (onError) onError(errorMessage);
      cleanup();
    }
  }, [autoStopOnSilence, cleanup, getAudioLevel, isSilent, onError, onRecordingComplete, onSilenceDetected, silenceDuration]);

  /**
   * Stop recording manually
   */
  const stopRecording = useCallback(() => {
    // Clear analysis interval first
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      // Request any remaining data before stopping
      // This ensures we get all encoded audio
      try {
        mediaRecorderRef.current.requestData();
      } catch (e) {
        // requestData may throw if recorder is in wrong state
        console.warn('requestData failed:', e);
      }
      
      // Small delay to ensure data is flushed, then stop
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 100);
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  /**
   * Reset all state for new recording
   */
  const resetRecording = useCallback(() => {
    cleanup();
    setError(null);
    setAudioBlob(null);
    setAudioLevel(0);
    setIsProcessing(false);
    chunksRef.current = [];
  }, [cleanup]);

  return {
    isRecording,
    isProcessing,
    audioBlob,
    error,
    audioLevel,
    startRecording,
    stopRecording,
    resetRecording,
  };
};

export default useVoiceRecorder;
