/**
 * useTextToSpeech - Custom hook for browser-based Text-to-Speech
 * 
 * Architecture Notes:
 * - Uses browser's native SpeechSynthesis API (FREE, no API key)
 * - Falls back gracefully if TTS not supported
 * - Provides queue management for multiple utterances
 * - Optimized settings for natural interview-like speech
 * 
 * Why browser TTS instead of cloud APIs?
 * - Completely FREE (no API costs)
 * - Works offline
 * - Low latency (no network round-trip)
 * - Good enough quality for interviews
 * - Can be upgraded to ElevenLabs later if needed
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// TTS Configuration - tuned for professional interview voice
const TTS_CONFIG = {
  rate: 0.9,        // Slightly slower than normal (1.0) for clarity
  pitch: 1.0,       // Neutral pitch
  volume: 1.0,      // Full volume
  lang: 'en-US',    // English (US) for consistent pronunciation
};

// Preferred voice names (in order of preference)
// These are typically the highest quality voices available
const PREFERRED_VOICES = [
  'Google US English',           // Chrome's high-quality voice
  'Microsoft David',             // Windows high-quality male
  'Microsoft Zira',              // Windows high-quality female
  'Samantha',                    // macOS high-quality
  'Alex',                        // macOS alternative
  'Google UK English Female',    // Alternative
  'Google UK English Male',      // Alternative
];

interface UseTextToSpeechOptions {
  onStart?: () => void;           // Called when speech starts
  onEnd?: () => void;             // Called when speech ends
  onError?: (error: string) => void;  // Called on error
  rate?: number;                  // Speech rate (0.1 - 10)
  pitch?: number;                 // Voice pitch (0 - 2)
}

interface UseTextToSpeechReturn {
  // State
  isSpeaking: boolean;
  isSupported: boolean;
  isReady: boolean;  // True when voices are loaded and TTS is ready
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  error: string | null;
  
  // Actions
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setVoice: (voice: SpeechSynthesisVoice) => void;
}

export const useTextToSpeech = (options: UseTextToSpeechOptions = {}): UseTextToSpeechReturn => {
  const {
    onStart,
    onEnd,
    onError,
    rate = TTS_CONFIG.rate,
    pitch = TTS_CONFIG.pitch,
  } = options;

  // State - Initialize isSupported immediately based on browser support
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [isReady, setIsReady] = useState(false);  // TTS fully ready
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ref for current utterance
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasInitialized = useRef(false);
  const isReadyRef = useRef(false);  // Ref to track ready state for closures

  /**
   * Find the best available voice from our preferred list
   */
  const selectBestVoice = useCallback((voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    // Try to find a preferred voice
    for (const preferredName of PREFERRED_VOICES) {
      const found = voices.find(v => 
        v.name.includes(preferredName) && v.lang.startsWith('en')
      );
      if (found) {
        console.log(`🎤 Selected voice: ${found.name}`);
        return found;
      }
    }

    // Fallback: find any English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      console.log(`🎤 Fallback voice: ${englishVoice.name}`);
      return englishVoice;
    }

    // Last resort: use first available
    console.log(`🎤 Using first available voice: ${voices[0].name}`);
    return voices[0];
  }, []);

  /**
   * Initialize TTS and load voices
   * Voices are loaded asynchronously in some browsers
   */
  useEffect(() => {
    // Check if TTS is supported
    if (!window.speechSynthesis) {
      setIsSupported(false);
      setError('Text-to-Speech is not supported in this browser');
      return;
    }

    setIsSupported(true);

    // Function to load and set voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log(`🎤 Voices loaded: ${voices.length} available`);
      
      if (voices.length > 0) {
        setAvailableVoices(voices);
        
        // Auto-select best voice if none selected
        if (!selectedVoice) {
          const bestVoice = selectBestVoice(voices);
          setSelectedVoice(bestVoice);
        }
        
        // Helper to mark TTS as ready (handles both state and ref)
        const markReady = (source: string) => {
          if (isReadyRef.current) return; // Already ready
          console.log(`🎤 TTS ready (${source})`);
          isReadyRef.current = true;
          setIsReady(true);
        };
        
        // Initialize TTS with a silent utterance to "wake it up"
        // This helps with Chrome's first-utterance issue
        if (!hasInitialized.current) {
          hasInitialized.current = true;
          
          // Cancel any pending speech first
          window.speechSynthesis.cancel();
          
          const silentUtterance = new SpeechSynthesisUtterance('.');
          silentUtterance.volume = 0.01; // Nearly silent but not zero (some browsers ignore zero)
          silentUtterance.rate = 10; // Fast to complete quickly
          
          silentUtterance.onend = () => {
            markReady('onend');
          };
          silentUtterance.onerror = () => {
            markReady('onerror');
          };
          
          window.speechSynthesis.speak(silentUtterance);
          
          // Fallback timeouts using ref to avoid closure issues
          setTimeout(() => {
            markReady('100ms timeout');
          }, 100);
          
          setTimeout(() => {
            markReady('300ms timeout');
          }, 300);
          
          setTimeout(() => {
            markReady('500ms timeout');
          }, 500);
        } else {
          // Already initialized, just mark ready immediately
          markReady('already initialized');
        }
      } else {
        // No voices yet, but TTS might still work
        // Mark as ready after a delay to allow for lazy loading
        setTimeout(() => {
          if (!isReadyRef.current && !hasInitialized.current) {
            hasInitialized.current = true;
            console.log('🎤 TTS ready (no voices yet, but proceeding)');
            isReadyRef.current = true;
            setIsReady(true);
          }
        }, 500);
      }
    };

    // Load voices immediately (works in Firefox)
    loadVoices();

    // Also listen for voiceschanged event (Chrome loads voices async)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Cleanup
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectBestVoice, selectedVoice]); // Removed isReady - using isReadyRef instead

  /**
   * Speak the given text
   * Handles queue management and natural speech patterns
   */
  const speak = useCallback((text: string) => {
    // Check window.speechSynthesis directly (don't rely on state due to closures)
    if (!window.speechSynthesis) {
      const errorMsg = 'TTS not supported in this browser';
      console.error('❌', errorMsg);
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    if (!text || text.trim().length === 0) {
      console.warn('Empty text provided to TTS');
      return;
    }

    console.log('🗣️ TTS speak() called with:', text.substring(0, 50) + '...');

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    try {
      // Create new utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Configure utterance
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = TTS_CONFIG.volume;
      utterance.lang = TTS_CONFIG.lang;

      // Set voice if available
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        setError(null);
        if (onStart) onStart();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };

      utterance.onerror = (event) => {
        setIsSpeaking(false);
        // Ignore 'interrupted' errors (happens when we cancel)
        if (event.error !== 'interrupted') {
          const errorMsg = `Speech error: ${event.error}`;
          setError(errorMsg);
          if (onError) onError(errorMsg);
        }
      };

      // Chrome bug workaround: Speech can get stuck
      // Reset synthesis if it gets stuck
      utterance.onpause = () => {
        // Resume after brief pause to prevent stuck state
        setTimeout(() => {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }, 100);
      };

      // Speak!
      window.speechSynthesis.speak(utterance);

      // Chrome bug workaround: Long texts can stop
      // Keep synthesis alive by periodic resume
      const keepAlive = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(keepAlive);
        } else {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);

      // Clear interval when speech ends
      utterance.onend = () => {
        clearInterval(keepAlive);
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'TTS failed';
      console.error('❌ TTS error:', errorMsg);
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  }, [onEnd, onError, onStart, pitch, rate, selectedVoice]);

  /**
   * Stop speaking immediately
   */
  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  /**
   * Pause speaking
   */
  const pause = useCallback(() => {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  }, []);

  /**
   * Resume speaking after pause
   */
  const resume = useCallback(() => {
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, []);

  /**
   * Set the voice to use for TTS
   */
  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
  }, []);

  return {
    isSpeaking,
    isSupported,
    isReady,
    availableVoices,
    selectedVoice,
    error,
    speak,
    stop,
    pause,
    resume,
    setVoice,
  };
};

export default useTextToSpeech;
