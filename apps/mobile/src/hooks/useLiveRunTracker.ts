import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  calculateAveragePaceSecPerKm,
  calculateCurrentPaceSecPerKm,
  haversineDistanceMeters,
  shouldAcceptLocation,
  type GeoPoint,
  type PaceSample,
} from "@runmate/shared";
import { LiveRunSocket } from "../api/live-run-socket";

interface UseLiveRunTrackerOptions {
  sessionId: string;
  userId: string;
  accessToken: string;
}

export interface LiveRunTrackerState {
  permissionStatus: "unknown" | "granted" | "denied";
  syncStatus: "idle" | "demo" | "connecting" | "open" | "closed" | "error";
  isTracking: boolean;
  elapsedSeconds: number;
  distanceMeters: number;
  currentPaceSecPerKm?: number;
  averagePaceSecPerKm?: number;
  accuracyMeters?: number;
  latitude?: number;
  longitude?: number;
  lastLocationAt?: string;
  error?: string;
}

const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 5,
};

export function useLiveRunTracker({ sessionId, userId, accessToken }: UseLiveRunTrackerOptions) {
  const [state, setState] = useState<LiveRunTrackerState>({
    permissionStatus: "unknown",
    syncStatus: "idle",
    isTracking: false,
    elapsedSeconds: 0,
    distanceMeters: 0,
  });
  const startedAtRef = useRef<number | undefined>(undefined);
  const previousPointRef = useRef<GeoPoint | undefined>(undefined);
  const distanceRef = useRef(0);
  const samplesRef = useRef<PaceSample[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const socketRef = useRef<LiveRunSocket | undefined>(undefined);

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = undefined;
    socketRef.current?.close();
    socketRef.current = undefined;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    setState((current) => ({ ...current, isTracking: false }));
  }, []);

  const start = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setState((current) => ({
        ...current,
        permissionStatus: "denied",
        error: "Location permission is required.",
      }));
      return;
    }

    startedAtRef.current = Date.now();
    previousPointRef.current = undefined;
    distanceRef.current = 0;
    samplesRef.current = [];
    if (accessToken === "demo-access-token") {
      socketRef.current = undefined;
    } else {
      socketRef.current = new LiveRunSocket();
      socketRef.current.connect({
        accessToken,
        sessionId,
        onEvent: () => undefined,
        onStatus: (syncStatus) => {
          setState((current) => ({ ...current, syncStatus }));
        },
      });
    }

    setState({
      permissionStatus: "granted",
      syncStatus: accessToken === "demo-access-token" ? "demo" : "connecting",
      isTracking: true,
      elapsedSeconds: 0,
      distanceMeters: 0,
    });

    timerRef.current = setInterval(() => {
      if (!startedAtRef.current) {
        return;
      }
      setState((current) => ({
        ...current,
        elapsedSeconds: Math.max(0, Math.round((Date.now() - startedAtRef.current!) / 1000)),
      }));
    }, 1000);

    subscriptionRef.current = await Location.watchPositionAsync(LOCATION_OPTIONS, (location) => {
      const recordedAt = new Date(location.timestamp).toISOString();
      const nextPoint: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude ?? undefined,
        accuracyMeters: location.coords.accuracy ?? undefined,
        recordedAt,
      };

      const previous = previousPointRef.current;
      if (previous && shouldAcceptLocation(previous, nextPoint)) {
        distanceRef.current += haversineDistanceMeters(previous, nextPoint);
      }
      previousPointRef.current = nextPoint;

      const elapsedSeconds = startedAtRef.current
        ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
        : 0;
      samplesRef.current = [
        ...samplesRef.current,
        { distanceMeters: distanceRef.current, elapsedSeconds },
      ].filter((sample) => elapsedSeconds - sample.elapsedSeconds <= 30);

      const currentPaceSecPerKm = calculateCurrentPaceSecPerKm(samplesRef.current);
      const averagePaceSecPerKm = calculateAveragePaceSecPerKm(distanceRef.current, elapsedSeconds);
      const distanceMeters = Math.round(distanceRef.current);

      socketRef.current?.send({
        type: "location:update",
        sessionId,
        payload: {
          latitude: nextPoint.latitude,
          longitude: nextPoint.longitude,
          altitude: nextPoint.altitude,
          accuracyMeters: nextPoint.accuracyMeters,
          heading: location.coords.heading ?? undefined,
          speedMps: location.coords.speed ?? undefined,
          distanceMeters,
          currentPaceSecPerKm,
          averagePaceSecPerKm,
          state: "running",
          recordedAt,
        },
      });

      setState((current) => ({
        ...current,
        elapsedSeconds,
        distanceMeters,
        currentPaceSecPerKm,
        averagePaceSecPerKm,
        accuracyMeters: nextPoint.accuracyMeters,
        latitude: nextPoint.latitude,
        longitude: nextPoint.longitude,
        lastLocationAt: recordedAt,
      }));
    });
  }, [accessToken, sessionId, userId]);

  useEffect(() => stop, [stop]);

  return useMemo(
    () => ({
      ...state,
      start,
      stop,
    }),
    [start, state, stop],
  );
}
