import type { GeoPoint } from "@runmate/shared";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type SoloRunStatus = "idle" | "running" | "paused" | "finished";

export interface SoloRunState {
  status: SoloRunStatus;
  elapsedSeconds: number;
  distanceMeters: number;
  currentPaceSecPerKm?: number;
  averagePaceSecPerKm?: number;
  acceptedRoute: GeoPoint[];
  startedAt?: string;
  finishedAt?: string;
  accuracyMeters?: number;
  speedMps?: number;
  currentPoint?: LatLng;
  trackingMessage: string;
  permissionStatus: "unknown" | "granted" | "denied";
  acceptedPointCount: number;
  rejectedPointCount: number;
  error?: string;
}

export interface SoloRunResult {
  distanceMeters: number;
  elapsedSeconds: number;
  averagePaceSecPerKm?: number;
  currentPaceSecPerKm?: number;
  route: GeoPoint[];
  startedAt: string;
  finishedAt: string;
  lastPoint?: GeoPoint;
}
