"use client";

/**
 * Responsibility:
 * - Maintain stable face tracks (ID assignment) across frames from face detections.
 *
 * Notes:
 * - Uses IoU + Hungarian assignment.
 * - Does not do identity recognition; IDs are ephemeral session-local track IDs.
 */

import type { FaceDetection, NormalizedBoundingBox } from "./PresenceDetector";
import { solveHungarianAssignment } from "./HungarianAssignment";

export type FaceTrack = {
  trackId: number;
  latestBoundingBox: NormalizedBoundingBox;
  latestConfidence: number;
  firstMatchedAtMs: number;
  lastMatchedAtMs: number;
  missedFrameCount: number;
  consecutiveMatchCount: number;
};

export type FaceTrackSettings = {
  assignmentIouThreshold: number;
  trackMaxMissedFrames: number;
  stableFramesRequired: number;
};

export type DetectionFilterSettings = {
  minFaceAreaRatio: number;
  interactionZoneMarginRatio: number;
};

export type DetectionRejectionReason =
  | "belowMinConfidence"
  | "belowMinFaceAreaRatio"
  | "outsideInteractionZone";

export type FilteredDetectionsResult = {
  acceptedDetections: FaceDetection[];
  rejectedDetections: Array<{
    detection: FaceDetection;
    rejectionReasons: DetectionRejectionReason[];
  }>;
};

export type TrackUpdateResult = {
  tracks: FaceTrack[];
  stableTracks: FaceTrack[];
  assignments: Array<{
    trackId: number;
    detectionIndex: number;
    iou: number;
    cost: number;
  }>;
  createdTrackIds: number[];
  removedTrackIds: number[];
};

const UNASSIGNED_COST = 0.99;
const UNMATCHABLE_COST = 1_000_000;

function clampToUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function getBoxCenter(box: NormalizedBoundingBox): { x: number; y: number } {
  return { x: box.xMin + box.width / 2, y: box.yMin + box.height / 2 };
}

function computeAreaRatio(box: NormalizedBoundingBox): number {
  return clampToUnit(box.width) * clampToUnit(box.height);
}

function isInInteractionZone(params: {
  boundingBox: NormalizedBoundingBox;
  interactionZoneMarginRatio: number;
}): boolean {
  const margin = params.interactionZoneMarginRatio;
  const center = getBoxCenter(params.boundingBox);
  const min = margin;
  const max = 1 - margin;
  return center.x >= min && center.x <= max && center.y >= min && center.y <= max;
}

export function filterDetectionsForPresence(params: {
  detections: FaceDetection[];
  minConfidence: number;
  filterSettings: DetectionFilterSettings;
}): FilteredDetectionsResult {
  const acceptedDetections: FaceDetection[] = [];
  const rejectedDetections: FilteredDetectionsResult["rejectedDetections"] = [];

  for (const detection of params.detections) {
    const rejectionReasons: DetectionRejectionReason[] = [];

    if (detection.confidence < params.minConfidence) {
      rejectionReasons.push("belowMinConfidence");
    }

    const areaRatio = computeAreaRatio(detection.boundingBox);
    if (areaRatio < params.filterSettings.minFaceAreaRatio) {
      rejectionReasons.push("belowMinFaceAreaRatio");
    }

    if (
      !isInInteractionZone({
        boundingBox: detection.boundingBox,
        interactionZoneMarginRatio: params.filterSettings.interactionZoneMarginRatio,
      })
    ) {
      rejectionReasons.push("outsideInteractionZone");
    }

    if (rejectionReasons.length > 0) {
      rejectedDetections.push({ detection, rejectionReasons });
      continue;
    }

    acceptedDetections.push(detection);
  }

  return { acceptedDetections, rejectedDetections };
}

function computeIntersectionOverUnion(
  a: NormalizedBoundingBox,
  b: NormalizedBoundingBox,
): number {
  const ax1 = a.xMin;
  const ay1 = a.yMin;
  const ax2 = a.xMin + a.width;
  const ay2 = a.yMin + a.height;

  const bx1 = b.xMin;
  const by1 = b.yMin;
  const bx2 = b.xMin + b.width;
  const by2 = b.yMin + b.height;

  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  const intersectionWidth = Math.max(0, ix2 - ix1);
  const intersectionHeight = Math.max(0, iy2 - iy1);
  const intersectionArea = intersectionWidth * intersectionHeight;
  const areaA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  const areaB = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
  const unionArea = areaA + areaB - intersectionArea;
  if (unionArea <= 0) return 0;
  return intersectionArea / unionArea;
}

function toSquareCostMatrix(params: {
  tracks: FaceTrack[];
  detections: FaceDetection[];
  assignmentIouThreshold: number;
}): { costMatrix: number[][]; paddedSize: number; trackCount: number; detectionCount: number } {
  const trackCount = params.tracks.length;
  const detectionCount = params.detections.length;
  const paddedSize = Math.max(trackCount, detectionCount);

  const costMatrix: number[][] = [];
  for (let rowIndex = 0; rowIndex < paddedSize; rowIndex += 1) {
    const row: number[] = [];
    for (let columnIndex = 0; columnIndex < paddedSize; columnIndex += 1) {
      const hasTrack = rowIndex < trackCount;
      const hasDetection = columnIndex < detectionCount;

      if (!hasTrack && !hasDetection) {
        row.push(0);
        continue;
      }

      if (!hasTrack || !hasDetection) {
        row.push(UNASSIGNED_COST);
        continue;
      }

      const track = params.tracks[rowIndex];
      const detection = params.detections[columnIndex];
      const iou = computeIntersectionOverUnion(
        track.latestBoundingBox,
        detection.boundingBox,
      );
      // Guard: IoU below threshold -> prefer unassigned over a bad match.
      if (iou < params.assignmentIouThreshold) {
        row.push(UNMATCHABLE_COST);
        continue;
      }
      row.push(1 - iou);
    }
    costMatrix.push(row);
  }

  return { costMatrix, paddedSize, trackCount, detectionCount };
}

export class FaceTrackManager {
  private nextTrackId = 1;
  private tracks: FaceTrack[] = [];
  private readonly settings: FaceTrackSettings;

  constructor(settings: FaceTrackSettings) {
    this.settings = settings;
  }

  getTracks(): FaceTrack[] {
    return this.tracks;
  }

  reset(): void {
    this.nextTrackId = 1;
    this.tracks = [];
  }

  update(params: {
    detections: FaceDetection[];
    detectedAtMs: number;
  }): TrackUpdateResult {
    const createdTrackIds: number[] = [];
    const removedTrackIds: number[] = [];
    const assignments: TrackUpdateResult["assignments"] = [];

    const { costMatrix, paddedSize, trackCount, detectionCount } = toSquareCostMatrix(
      {
        tracks: this.tracks,
        detections: params.detections,
        assignmentIouThreshold: this.settings.assignmentIouThreshold,
      },
    );

    const assignmentByRow = solveHungarianAssignment(costMatrix);
    const matchedDetectionIndexByTrackIndex = new Array<number>(trackCount).fill(-1);

    for (let rowIndex = 0; rowIndex < paddedSize; rowIndex += 1) {
      const columnIndex = assignmentByRow[rowIndex];
      const hasTrack = rowIndex < trackCount;
      const hasDetection = columnIndex >= 0 && columnIndex < detectionCount;

      if (hasTrack && hasDetection) {
        const track = this.tracks[rowIndex];
        const detection = params.detections[columnIndex];
        const iou = computeIntersectionOverUnion(
          track.latestBoundingBox,
          detection.boundingBox,
        );
        // Guard: assignment might still be an unmatchable edge case (padding or huge cost).
        if (iou < this.settings.assignmentIouThreshold) continue;
        matchedDetectionIndexByTrackIndex[rowIndex] = columnIndex;
        assignments.push({
          trackId: track.trackId,
          detectionIndex: columnIndex,
          iou,
          cost: 1 - iou,
        });
      }
    }

    const matchedDetectionIndexSet = new Set<number>(
      matchedDetectionIndexByTrackIndex.filter((index) => index >= 0),
    );

    const nextTracks: FaceTrack[] = [];
    for (let trackIndex = 0; trackIndex < this.tracks.length; trackIndex += 1) {
      const track = this.tracks[trackIndex];
      const detectionIndex = matchedDetectionIndexByTrackIndex[trackIndex];
      if (detectionIndex === -1) {
        const nextMissedFrameCount = track.missedFrameCount + 1;
        // Guard: drop tracks that have been missing for too long.
        if (nextMissedFrameCount > this.settings.trackMaxMissedFrames) {
          removedTrackIds.push(track.trackId);
          continue;
        }
        nextTracks.push({
          ...track,
          missedFrameCount: nextMissedFrameCount,
          consecutiveMatchCount: 0,
        });
        continue;
      }

      const detection = params.detections[detectionIndex];
      nextTracks.push({
        ...track,
        latestBoundingBox: detection.boundingBox,
        latestConfidence: detection.confidence,
        lastMatchedAtMs: params.detectedAtMs,
        missedFrameCount: 0,
        consecutiveMatchCount: track.consecutiveMatchCount + 1,
      });
    }

    for (let detectionIndex = 0; detectionIndex < params.detections.length; detectionIndex += 1) {
      if (matchedDetectionIndexSet.has(detectionIndex)) continue;
      const detection = params.detections[detectionIndex];
      const trackId = this.nextTrackId;
      this.nextTrackId += 1;
      createdTrackIds.push(trackId);
      nextTracks.push({
        trackId,
        latestBoundingBox: detection.boundingBox,
        latestConfidence: detection.confidence,
        firstMatchedAtMs: params.detectedAtMs,
        lastMatchedAtMs: params.detectedAtMs,
        missedFrameCount: 0,
        consecutiveMatchCount: 1,
      });
    }

    this.tracks = nextTracks;

    const stableTracks = this.tracks.filter(
      (track) => track.consecutiveMatchCount >= this.settings.stableFramesRequired,
    );

    return {
      tracks: this.tracks,
      stableTracks,
      assignments,
      createdTrackIds,
      removedTrackIds,
    };
  }
}

