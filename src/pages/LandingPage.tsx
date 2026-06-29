import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import RecordingModal from '../components/RecordingModal';
import styles from './LandingPage.module.css';

const testSentences = [
  "The quick brown fox jumps over the lazy dog and runs through the peaceful meadow.",
  "Technology has revolutionized the way we communicate and interact with each other daily.",
  "Artificial intelligence is transforming industries and creating new opportunities for innovation.",
  "Climate change requires immediate action from governments, businesses, and individuals worldwide.",
  "Education is the foundation of progress and the key to unlocking human potential.",
  "Collaboration between diverse teams often leads to more creative and effective solutions.",
  "The future of work will likely involve more remote collaboration and digital transformation.",
  "Sustainable development practices are essential for preserving our planet for future generations."
];

const LandingPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [currentSentence, setCurrentSentence] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Generate random sentence on component mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * testSentences.length);
    setCurrentSentence(testSentences[randomIndex]);
  }, []);

  // Request camera and microphone permissions on component mount
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      setError('');
      setIsCheckingPermissions(true);

      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera and microphone access.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setHasPermissions(true);
    } catch (err) {
      console.error('Error accessing media devices:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera and microphone access was denied. Please allow access and refresh the page.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found. Please connect your devices and try again.');
        } else if (err.name === 'NotSupportedError') {
          setError('Your browser does not support camera and microphone access.');
        } else {
          setError(err.message || 'An error occurred while accessing your camera and microphone.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  const startAudioRecording = () => {
    try {
      if (!streamRef.current) {
        setError('No media stream available. Please refresh and allow microphone access.');
        return;
      }

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        setError('Recording is not supported in your browser.');
        return;
      }

      recordedChunksRef.current = [];
      
      // Create audio-only stream
      const audioStream = new MediaStream(streamRef.current.getAudioTracks());
      
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(recordedChunksRef.current, {
          type: 'audio/webm'
        });
        
        const url = URL.createObjectURL(recordedBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please try again.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecordedAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const generateNewSentence = () => {
    const randomIndex = Math.floor(Math.random() * testSentences.length);
    setCurrentSentence(testSentences[randomIndex]);
    // Clear previous recording
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className={styles.landingPage}>
      <Navbar />
      
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Compatibility Test</h1>
            <p>Test your camera and microphone compatibility for the best interview experience</p>
          </div>

          <div className={styles.contentBlocks}>
            {/* Video/Audio Block */}
            <div className={styles.videoBlock}>
              <h2>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM16 16H4V8h12v8z"/>
                </svg>
                Camera Preview
              </h2>
              {isCheckingPermissions ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p>Requesting camera and microphone access...</p>
                </div>
              ) : error ? (
                <div className={styles.errorContainer}>
                  <div className={styles.errorIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <h3>Oops! Something went wrong</h3>
                  <p>{error}</p>
                  <button className={styles.retryBtn} onClick={requestPermissions}>
                    Try Again
                  </button>
                </div>
              ) : hasPermissions ? (
                <>
                  <div className={styles.videoContainer}>
                    <video
                      ref={videoRef}
                      className={styles.video}
                      autoPlay
                      muted
                      playsInline
                    />
                  </div>
                  
                  {/* Audio Recording Section */}
                  <div className={styles.audioSection}>
                    <h3>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                      </svg>
                      Microphone Test
                    </h3>
                    
                    <div className={styles.sentenceContainer}>
                      <div className={styles.sentenceLabel}>Read this sentence aloud:</div>
                      <div className={styles.sentenceText}>"{currentSentence}"</div>
                    </div>
                    
                    <div className={styles.audioControls}>
                      <button
                        className={`${styles.micTestBtn} ${isRecording ? styles.recording : ''}`}
                        onClick={isRecording ? stopAudioRecording : startAudioRecording}
                        disabled={!hasPermissions}
                      >
                        {isRecording ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="10"/>
                            </svg>
                            Stop Recording
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                            </svg>
                            Start Mic Test
                          </>
                        )}
                      </button>
                      
                      {audioUrl && (
                        <button
                          className={styles.replayBtn}
                          onClick={playRecordedAudio}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                          Replay Audio
                        </button>
                      )}
                      
                      <button
                        className={styles.replayBtn}
                        onClick={generateNewSentence}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                        </svg>
                        New Sentence
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Instructions Block */}
            <div className={styles.instructionsBlock}>
              <h2>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-10h8v2H8v-2zm0 3h8v2H8v-2zm0 3h5v2H8v-2z"/>
                </svg>
                Test Instructions
              </h2>
              <ul className={styles.instructionsList}>
                <li>Allow camera and microphone access when prompted by your browser</li>
                <li>Check your camera preview to ensure proper positioning and lighting</li>
                <li>Read the provided sentence aloud clearly into your microphone</li>
                <li>Click "Start Mic Test" and speak the sentence naturally</li>
                <li>Use "Replay Audio" to verify your recording quality and volume</li>
                <li>Generate new sentences to practice different speech patterns</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <RecordingModal
        isOpen={isModalOpen}
        onClose={closeModal}
        recordingUrl={audioUrl}
      />
    </div>
  );
};

export default LandingPage;