/**
 * Camera Analysis Service
 *
 * Uses face-api.js (TensorFlow.js-based) to run face detection,
 * emotion recognition, and attention tracking entirely in the browser.
 *
 * Detects:
 * - Face absent (candidate left the screen)
 * - Multiple faces (someone else in frame)
 * - Looking away / not facing screen
 * - Emotion classification
 */

import * as faceapi from 'face-api.js';

export interface CameraMetrics {
  attentionScore: number;
  presenceScore: number;
  dominantEmotion: string;
  emotionDistribution: Record<string, number>;
  distractionCount: number;
  multipleFaceCount: number;
  cameraScore: number;
}

export interface FrameResult {
  faceDetected: boolean;
  faceCount: number;
  lookingAtScreen: boolean;
  emotion: string;
}

const MODEL_URL = '/models';

let modelsLoaded = false;

export async function loadCameraModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('Camera analysis models loaded');
    return true;
  } catch (err) {
    console.error('Failed to load face-api models:', err);
    return false;
  }
}

export function areCameraModelsLoaded(): boolean {
  return modelsLoaded;
}

export async function analyzeFrame(video: HTMLVideoElement): Promise<FrameResult> {
  if (!modelsLoaded) {
    return { faceDetected: false, faceCount: 0, lookingAtScreen: false, emotion: 'unknown' };
  }

  try {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.35 }))
      .withFaceLandmarks(true)
      .withFaceExpressions();

    const faceCount = detections.length;

    if (faceCount === 0) {
      return { faceDetected: false, faceCount: 0, lookingAtScreen: false, emotion: 'unknown' };
    }

    // Use the largest face (closest to camera = the candidate)
    const primary = detections.reduce((best, det) =>
      det.detection.box.area > best.detection.box.area ? det : best
    );

    const lookingAtScreen = isLookingAtScreen(primary, video);

    const expressions = primary.expressions as unknown as Record<string, number>;
    const dominantEmotion = Object.entries(expressions).reduce(
      (max, [emotion, score]) => (score > max[1] ? [emotion, score] : max),
      ['neutral', 0]
    )[0] as string;

    return {
      faceDetected: true,
      faceCount,
      lookingAtScreen,
      emotion: dominantEmotion,
    };
  } catch {
    return { faceDetected: false, faceCount: 0, lookingAtScreen: false, emotion: 'unknown' };
  }
}

function isLookingAtScreen(
  detection: faceapi.WithFaceExpressions<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>,
  video: HTMLVideoElement
): boolean {
  const box = detection.detection.box;
  const videoWidth = video.videoWidth || video.width;
  const videoHeight = video.videoHeight || video.height;

  if (videoWidth === 0 || videoHeight === 0) return false;

  const faceCenterX = box.x + box.width / 2;
  const faceCenterY = box.y + box.height / 2;

  const relX = faceCenterX / videoWidth;
  const relY = faceCenterY / videoHeight;

  const isHorizontallyCentered = relX > 0.15 && relX < 0.85;
  const isVerticallyCentered = relY > 0.1 && relY < 0.9;

  const landmarks = detection.landmarks;
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();

  const eyeCenter = {
    x: (leftEye[0].x + rightEye[3].x) / 2,
    y: (leftEye[0].y + rightEye[3].y) / 2,
  };
  const noseCenter = nose[3];

  const horizontalOffset = Math.abs(eyeCenter.x - noseCenter.x);
  const faceWidth = box.width;
  const normalizedOffset = horizontalOffset / faceWidth;

  const isFacingForward = normalizedOffset < 0.18;

  return isHorizontallyCentered && isVerticallyCentered && isFacingForward;
}

export function computeCameraMetrics(frameResults: FrameResult[]): CameraMetrics {
  if (frameResults.length === 0) {
    return {
      attentionScore: 0,
      presenceScore: 0,
      dominantEmotion: 'unknown',
      emotionDistribution: {},
      distractionCount: 0,
      multipleFaceCount: 0,
      cameraScore: 0,
    };
  }

  const totalFrames = frameResults.length;
  const facePresentFrames = frameResults.filter((f) => f.faceDetected).length;
  const lookingFrames = frameResults.filter((f) => f.lookingAtScreen).length;
  const multipleFaceFrames = frameResults.filter((f) => f.faceCount > 1).length;

  const presenceScore = facePresentFrames / totalFrames;
  const attentionScore = lookingFrames / totalFrames;

  const emotionCounts: Record<string, number> = {};
  for (const frame of frameResults) {
    if (frame.faceDetected && frame.emotion !== 'unknown') {
      emotionCounts[frame.emotion] = (emotionCounts[frame.emotion] || 0) + 1;
    }
  }

  const totalEmotionFrames = Object.values(emotionCounts).reduce((a, b) => a + b, 0) || 1;
  const emotionDistribution: Record<string, number> = {};
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    emotionDistribution[emotion] = Math.round((count / totalEmotionFrames) * 100) / 100;
  }

  const dominantEmotion =
    Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  // Count distraction episodes (consecutive frames not looking at screen)
  let distractionCount = 0;
  let consecutiveAway = 0;
  for (const frame of frameResults) {
    if (!frame.lookingAtScreen) {
      consecutiveAway++;
      if (consecutiveAway === 2) {
        distractionCount++;
      }
    } else {
      consecutiveAway = 0;
    }
  }

  let cameraScore = 10.0;

  // Penalize for not looking at screen
  cameraScore -= (1 - attentionScore) * 4;

  // Penalize for face not present (away from screen)
  cameraScore -= (1 - presenceScore) * 3;

  // Penalize for distractions
  cameraScore -= Math.min(2, distractionCount * 0.3);

  // Penalize for multiple faces detected (potential cheating / distraction)
  const multipleFaceRatio = multipleFaceFrames / totalFrames;
  if (multipleFaceRatio > 0.3) {
    cameraScore -= 2.0;
  } else if (multipleFaceRatio > 0.1) {
    cameraScore -= 1.0;
  }

  cameraScore = Math.round(Math.max(1, Math.min(10, cameraScore)) * 10) / 10;

  return {
    attentionScore: Math.round(attentionScore * 100) / 100,
    presenceScore: Math.round(presenceScore * 100) / 100,
    dominantEmotion,
    emotionDistribution,
    distractionCount,
    multipleFaceCount: multipleFaceFrames,
    cameraScore,
  };
}
