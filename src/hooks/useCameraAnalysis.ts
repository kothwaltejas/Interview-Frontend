/**
 * React hook for real-time camera analysis during interviews.
 *
 * Uses an externally-provided video element (from VoiceInterview's existing
 * camera stream) instead of creating a separate stream.
 * Runs face-api.js detection at intervals and accumulates FrameResults.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  loadCameraModels,
  analyzeFrame,
  computeCameraMetrics,
  areCameraModelsLoaded,
  type CameraMetrics,
  type FrameResult,
} from '../services/cameraAnalyzer';

interface UseCameraAnalysisOptions {
  intervalMs?: number;
}

interface UseCameraAnalysisReturn {
  isReady: boolean;
  isAnalyzing: boolean;
  startAnalysis: (videoElement: HTMLVideoElement) => void;
  stopAnalysis: () => void;
  getMetrics: () => CameraMetrics;
  resetMetrics: () => void;
  currentEmotion: string;
  currentFaceCount: number;
}

export function useCameraAnalysis(
  options: UseCameraAnalysisOptions = {}
): UseCameraAnalysisReturn {
  const { intervalMs = 3000 } = options;

  const intervalRef = useRef<number | null>(null);
  const frameResultsRef = useRef<FrameResult[]>([]);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [currentFaceCount, setCurrentFaceCount] = useState(0);

  useEffect(() => {
    loadCameraModels().then((loaded) => {
      setIsReady(loaded);
    });
  }, []);

  const startAnalysis = useCallback((videoElement: HTMLVideoElement) => {
    if (!areCameraModelsLoaded()) return;
    if (intervalRef.current) return;

    videoElRef.current = videoElement;
    frameResultsRef.current = [];
    setIsAnalyzing(true);

    intervalRef.current = window.setInterval(async () => {
      const el = videoElRef.current;
      if (!el || el.paused || el.readyState < 2) return;

      const result = await analyzeFrame(el);
      frameResultsRef.current.push(result);
      setCurrentEmotion(result.emotion);
      setCurrentFaceCount(result.faceCount);
    }, intervalMs);
  }, [intervalMs]);

  const stopAnalysis = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    videoElRef.current = null;
    setIsAnalyzing(false);
  }, []);

  useEffect(() => {
    return () => stopAnalysis();
  }, [stopAnalysis]);

  const getMetrics = useCallback((): CameraMetrics => {
    return computeCameraMetrics(frameResultsRef.current);
  }, []);

  const resetMetrics = useCallback(() => {
    frameResultsRef.current = [];
    setCurrentEmotion('neutral');
    setCurrentFaceCount(0);
  }, []);

  return {
    isReady,
    isAnalyzing,
    startAnalysis,
    stopAnalysis,
    getMetrics,
    resetMetrics,
    currentEmotion,
    currentFaceCount,
  };
}
