import React from 'react';
import styles from './RecordingModal.module.css';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordingUrl: string | null;
}

const RecordingModal: React.FC<RecordingModalProps> = ({
  isOpen,
  onClose,
  recordingUrl,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Audio Playback</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className={styles.videoContainer}>
          {recordingUrl ? (
            <audio
              className={styles.audio}
              src={recordingUrl}
              controls
              autoPlay
            />
          ) : (
            <div className={styles.noVideo}>
              <p>No recording available</p>
            </div>
          )}
        </div>
        
        <div className={styles.actions}>
          <button className={styles.closeModalBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingModal;