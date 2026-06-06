export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracyMeters?: number;
  recordedAt?: string;
}

export interface PaceSample {
  distanceMeters: number;
  elapsedSeconds: number;
}

export type LocationRejectReason = "low_accuracy" | "too_fast" | "stale_or_invalid_time" | "too_short";

export interface LocationAssessment {
  accepted: boolean;
  reason?: LocationRejectReason;
  speedMps?: number;
  distanceMeters?: number;
  elapsedSeconds?: number;
  shouldResetAnchor?: boolean;
}

export interface ProgressComparison {
  userId: string;
  distanceMeters: number;
  rank: number;
  deltaFromLeaderMeters: number;
  progressRatio?: number;
}

const EARTH_RADIUS_METERS = 6371000;
const MIN_DISTANCE_FOR_PACE_METERS = 20;
const MAX_ACCEPTABLE_ACCURACY_METERS = 50;
const MAX_REASONABLE_RUNNING_SPEED_MPS = 12;
const MIN_COUNTED_SEGMENT_DISTANCE_METERS = 3;
const MAX_SEGMENT_GAP_SECONDS = 30;
const MAX_STALE_SEGMENT_DISTANCE_METERS = 100;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(from: GeoPoint, to: GeoPoint): number {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function assessLocationForRunning(previous: GeoPoint | undefined, next: GeoPoint): LocationAssessment {
  if (next.accuracyMeters !== undefined && next.accuracyMeters > MAX_ACCEPTABLE_ACCURACY_METERS) {
    return {
      accepted: false,
      reason: "low_accuracy",
    };
  }

  if (!previous?.recordedAt || !next.recordedAt) {
    return {
      accepted: true,
      distanceMeters: previous ? haversineDistanceMeters(previous, next) : 0,
    };
  }

  const distance = haversineDistanceMeters(previous, next);
  const elapsedSeconds = (Date.parse(next.recordedAt) - Date.parse(previous.recordedAt)) / 1000;

  if (elapsedSeconds <= 0) {
    return {
      accepted: false,
      reason: "stale_or_invalid_time",
      distanceMeters: distance,
      elapsedSeconds,
    };
  }

  if (distance < MIN_COUNTED_SEGMENT_DISTANCE_METERS) {
    return {
      accepted: false,
      reason: "too_short",
      distanceMeters: distance,
      elapsedSeconds,
      speedMps: distance / elapsedSeconds,
    };
  }

  if (elapsedSeconds > MAX_SEGMENT_GAP_SECONDS && distance > MAX_STALE_SEGMENT_DISTANCE_METERS) {
    return {
      accepted: false,
      reason: "stale_or_invalid_time",
      distanceMeters: distance,
      elapsedSeconds,
      speedMps: distance / elapsedSeconds,
      shouldResetAnchor: true,
    };
  }

  const speedMps = distance / elapsedSeconds;
  if (speedMps > MAX_REASONABLE_RUNNING_SPEED_MPS) {
    return {
      accepted: false,
      reason: "too_fast",
      distanceMeters: distance,
      elapsedSeconds,
      speedMps,
    };
  }

  return {
    accepted: true,
    distanceMeters: distance,
    elapsedSeconds,
    speedMps,
  };
}

export function shouldAcceptLocation(previous: GeoPoint | undefined, next: GeoPoint): boolean {
  return assessLocationForRunning(previous, next).accepted;
}

export function calculateTotalDistanceMeters(points: GeoPoint[]): number {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  let previous = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const next = points[index];
    const assessment = assessLocationForRunning(previous, next);
    if (assessment.accepted) {
      total += assessment.distanceMeters ?? haversineDistanceMeters(previous, next);
      previous = next;
    } else if (assessment.shouldResetAnchor) {
      previous = next;
    }
  }

  return Math.round(total);
}

export function calculateAveragePaceSecPerKm(distanceMeters: number, movingTimeSeconds: number): number | undefined {
  if (distanceMeters < MIN_DISTANCE_FOR_PACE_METERS || movingTimeSeconds <= 0) {
    return undefined;
  }

  return Math.round(movingTimeSeconds / (distanceMeters / 1000));
}

export function calculateCurrentPaceSecPerKm(samples: PaceSample[]): number | undefined {
  if (samples.length < 2) {
    return undefined;
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const distanceDelta = last.distanceMeters - first.distanceMeters;
  const timeDelta = last.elapsedSeconds - first.elapsedSeconds;

  return calculateAveragePaceSecPerKm(distanceDelta, timeDelta);
}

export function formatPace(secPerKm: number | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) {
    return "--:--";
  }

  const minutes = Math.floor(secPerKm / 60);
  const seconds = secPerKm % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function compareProgress(
  participants: Array<{ userId: string; distanceMeters: number }>,
  targetDistanceMeters?: number,
): ProgressComparison[] {
  const sorted = [...participants].sort((a, b) => b.distanceMeters - a.distanceMeters);
  const leaderDistance = sorted[0]?.distanceMeters ?? 0;

  return sorted.map((participant, index) => ({
    userId: participant.userId,
    distanceMeters: participant.distanceMeters,
    rank: index + 1,
    deltaFromLeaderMeters: Math.round(participant.distanceMeters - leaderDistance),
    progressRatio: targetDistanceMeters ? Math.min(participant.distanceMeters / targetDistanceMeters, 1) : undefined,
  }));
}
