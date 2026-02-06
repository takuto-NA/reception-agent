"use client";

/**
 * Responsibility:
 * - Detect faces from a camera video element using MediaPipe Tasks Vision.
 *
 * Notes:
 * - This module runs on the client only.
 * - It returns normalized bounding boxes so downstream tracking is resolution-agnostic.
 */

import {
  FaceDetector,
  FilesetResolver,
  type Detection,
} from "@mediapipe/tasks-vision";

export type NormalizedBoundingBox = {
  xMin: number;
  yMin: number;
  width: number;
  height: number;
};

export type FaceDetection = {
  confidence: number;
  boundingBox: NormalizedBoundingBox;
};

export type PresenceDetectorSettings = {
  detectionFps: number;
  maxFaces: number;
  minConfidence: number;
  visionWasmBaseUrl: string;
  faceDetectorModelUrl: string;
};

export type FaceDetectionResult = {
  detections: FaceDetection[];
  videoWidth: number;
  videoHeight: number;
  detectedAtMs: number;
};

const MEDIAPIPE_TASKS_VISION_VERSION = "0.10.32";
const DEFAULT_VISION_WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;

// Default model: BlazeFace short-range (good for laptop/desk camera distances).
const DEFAULT_FACE_DETECTOR_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

function clampToUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toNormalizedBoundingBox(params: {
  detection: Detection;
  videoWidth: number;
  videoHeight: number;
}): NormalizedBoundingBox | null {
  const boundingBox = params.detection.boundingBox;
  const videoWidth = params.videoWidth;
  const videoHeight = params.videoHeight;
  // Guard: missing or invalid dimensions.
  if (!boundingBox || videoWidth <= 0 || videoHeight <= 0) return null;

  const xMin = boundingBox.originX / videoWidth;
  const yMin = boundingBox.originY / videoHeight;
  const width = boundingBox.width / videoWidth;
  const height = boundingBox.height / videoHeight;

  return {
    xMin: clampToUnit(xMin),
    yMin: clampToUnit(yMin),
    width: clampToUnit(width),
    height: clampToUnit(height),
  };
}

function readDetectionConfidence(detection: Detection): number {
  const categories = detection.categories ?? [];
  const firstCategory = categories[0];
  const score = firstCategory?.score;
  if (typeof score === "number" && Number.isFinite(score)) return score;
  return 0;
}

export class PresenceDetector {
  private faceDetector: FaceDetector | null = null;
  private lastDetectedAtMs = 0;
  private readonly settings: PresenceDetectorSettings;

  constructor(partialSettings: Omit<PresenceDetectorSettings, "visionWasmBaseUrl" | "faceDetectorModelUrl"> & {
    visionWasmBaseUrl?: string;
    faceDetectorModelUrl?: string;
  }) {
    this.settings = {
      detectionFps: partialSettings.detectionFps,
      maxFaces: partialSettings.maxFaces,
      minConfidence: partialSettings.minConfidence,
      visionWasmBaseUrl: partialSettings.visionWasmBaseUrl ?? DEFAULT_VISION_WASM_BASE_URL,
      faceDetectorModelUrl: partialSettings.faceDetectorModelUrl ?? DEFAULT_FACE_DETECTOR_MODEL_URL,
    };
  }

  async initialize(): Promise<void> {
    // Guard: already initialized.
    if (this.faceDetector) return;

    const vision = await FilesetResolver.forVisionTasks(
      this.settings.visionWasmBaseUrl,
    );

    this.faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: this.settings.faceDetectorModelUrl,
      },
      runningMode: "VIDEO",
      minDetectionConfidence: this.settings.minConfidence,
    });
  }

  close(): void {
    this.faceDetector?.close();
    this.faceDetector = null;
  }

  detect(videoElement: HTMLVideoElement): FaceDetectionResult | null {
    /**
     * Responsibility:
     * - Run detection at a bounded rate and return normalized bounding boxes.
     */
    const faceDetector = this.faceDetector;
    // Guard: detector not initialized.
    if (!faceDetector) return null;

    const detectedAtMs = performance.now();
    const detectionIntervalMs = 1000 / Math.max(this.settings.detectionFps, 1);
    // Guard: skip to respect configured detection FPS.
    if (detectedAtMs - this.lastDetectedAtMs < detectionIntervalMs) return null;
    this.lastDetectedAtMs = detectedAtMs;

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    // Guard: video metadata not ready.
    if (!videoWidth || !videoHeight) return null;

    const mpResult = faceDetector.detectForVideo(videoElement, detectedAtMs);
    const mpDetections = mpResult.detections ?? [];

    const detections: FaceDetection[] = [];
    for (const detection of mpDetections) {
      const confidence = readDetectionConfidence(detection);
      // Guard: confidence below threshold.
      if (confidence < this.settings.minConfidence) continue;

      const boundingBox = toNormalizedBoundingBox({ detection, videoWidth, videoHeight });
      // Guard: invalid bounding box.
      if (!boundingBox) continue;

      detections.push({ confidence, boundingBox });
      // Guard: cap results even if the underlying model returns more.
      if (detections.length >= this.settings.maxFaces) break;
    }

    return { detections, videoWidth, videoHeight, detectedAtMs };
  }
}

