import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  assessLocationForRunning,
  calculateAveragePaceSecPerKm,
  calculateCurrentPaceSecPerKm,
  type GeoPoint,
  type PaceSample,
} from "@runmate/shared";
import type { SoloRunResult, SoloRunState } from "../types/soloRun";

const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 5,
};

const INITIAL_STATE: SoloRunState = {
  status: "idle",
  elapsedSeconds: 0,
  distanceMeters: 0,
  acceptedRoute: [],
  trackingMessage: "Waiting to start",
  permissionStatus: "unknown",
  acceptedPointCount: 0,
  rejectedPointCount: 0,
};

export function useSoloRun() {
  const [state, setState] = useState<SoloRunState>(INITIAL_STATE);
  const startedAtRef = useRef<number | undefined>(undefined);
  const pausedAtRef = useRef<number | undefined>(undefined);
  const pausedDurationMsRef = useRef(0);
  const distanceRef = useRef(0);
  const acceptedPointRef = useRef<GeoPoint | undefined>(undefined);
  const routeRef = useRef<GeoPoint[]>([]);
  const samplesRef = useRef<PaceSample[]>([]);
  const stateRef = useRef<SoloRunState>(INITIAL_STATE);
  const subscriptionRef = useRef<Location.LocationSubscription | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const patchState = useCallback((updater: (current: SoloRunState) => SoloRunState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const stopLocation = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = undefined;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const calculateElapsedSeconds = useCallback(() => {
    if (!startedAtRef.current) {
      return 0;
    }
    const pausedNow = pausedAtRef.current ? Date.now() - pausedAtRef.current : 0;
    return Math.max(0, Math.round((Date.now() - startedAtRef.current - pausedDurationMsRef.current - pausedNow) / 1000));
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      patchState((current) => ({
        ...current,
        elapsedSeconds: calculateElapsedSeconds(),
      }));
    }, 1000);
  }, [calculateElapsedSeconds, patchState, stopTimer]);

  const handleLocationUpdate = useCallback(
    (location: Location.LocationObject) => {
      if (stateRef.current.status !== "running") {
        return;
      }
      const recordedAt = new Date(location.timestamp).toISOString();
      const nextPoint: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude ?? undefined,
        accuracyMeters: location.coords.accuracy ?? undefined,
        recordedAt,
      };
      const assessment = assessLocationForRunning(acceptedPointRef.current, nextPoint);
      const elapsedSeconds = calculateElapsedSeconds();
      let trackingMessage = "Tracking normally";
      let acceptedPointIncrement = 0;
      let rejectedPointIncrement = 0;

      if (assessment.accepted) {
        distanceRef.current += assessment.distanceMeters ?? 0;
        acceptedPointRef.current = nextPoint;
        routeRef.current = [...routeRef.current, nextPoint].slice(-1000);
        acceptedPointIncrement = 1;
      } else {
        rejectedPointIncrement = 1;
        if (assessment.reason === "low_accuracy") {
          trackingMessage = "Weak GPS signal - distance paused";
        } else if (assessment.reason === "too_fast") {
          trackingMessage = "Movement too fast for running - not counted";
        } else {
          trackingMessage = "Waiting for stable GPS";
        }
        if (assessment.shouldResetAnchor) {
          acceptedPointRef.current = nextPoint;
          routeRef.current = [...routeRef.current, nextPoint].slice(-1000);
        }
      }

      samplesRef.current = [
        ...samplesRef.current,
        { distanceMeters: distanceRef.current, elapsedSeconds },
      ].filter((sample) => elapsedSeconds - sample.elapsedSeconds <= 30);
      const currentPaceSecPerKm = calculateCurrentPaceSecPerKm(samplesRef.current);
      const averagePaceSecPerKm = calculateAveragePaceSecPerKm(distanceRef.current, elapsedSeconds);
      const speedMps = location.coords.speed ?? assessment.speedMps;

      patchState((current) => ({
        ...current,
        acceptedPointCount: current.acceptedPointCount + acceptedPointIncrement,
        acceptedRoute: routeRef.current,
        accuracyMeters: nextPoint.accuracyMeters,
        averagePaceSecPerKm,
        currentPaceSecPerKm,
        currentPoint: {
          latitude: nextPoint.latitude,
          longitude: nextPoint.longitude,
        },
        distanceMeters: Math.round(distanceRef.current),
        elapsedSeconds,
        rejectedPointCount: current.rejectedPointCount + rejectedPointIncrement,
        speedMps,
        trackingMessage,
      }));
    },
    [calculateElapsedSeconds, patchState],
  );

  const startWatching = useCallback(async () => {
    stopLocation();
    subscriptionRef.current = await Location.watchPositionAsync(LOCATION_OPTIONS, handleLocationUpdate);
  }, [handleLocationUpdate, stopLocation]);

  const start = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      patchState((current) => ({
        ...current,
        error: "Location permission is required.",
        permissionStatus: "denied",
        trackingMessage: "Location permission is disabled",
      }));
      return false;
    }

    const startedAt = new Date().toISOString();
    startedAtRef.current = Date.now();
    pausedAtRef.current = undefined;
    pausedDurationMsRef.current = 0;
    distanceRef.current = 0;
    acceptedPointRef.current = undefined;
    routeRef.current = [];
    samplesRef.current = [];
    stateRef.current = {
      ...INITIAL_STATE,
      permissionStatus: "granted",
      startedAt,
      status: "running",
      trackingMessage: "Waiting for GPS signal",
    };
    setState(stateRef.current);
    startTimer();
    await startWatching();
    return true;
  }, [patchState, startTimer, startWatching]);

  const pause = useCallback(() => {
    if (stateRef.current.status !== "running") {
      return;
    }
    pausedAtRef.current = Date.now();
    stopLocation();
    patchState((current) => ({
      ...current,
      status: "paused",
      trackingMessage: "Paused",
    }));
  }, [patchState, stopLocation]);

  const resume = useCallback(async () => {
    if (stateRef.current.status !== "paused") {
      return;
    }
    if (pausedAtRef.current) {
      pausedDurationMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = undefined;
    }
    patchState((current) => ({
      ...current,
      status: "running",
      trackingMessage: "Tracking normally",
    }));
    await startWatching();
  }, [patchState, startWatching]);

  const finish = useCallback((): SoloRunResult | undefined => {
    if (!stateRef.current.startedAt) {
      return undefined;
    }
    const finishedAt = new Date().toISOString();
    stopLocation();
    stopTimer();
    const elapsedSeconds = calculateElapsedSeconds();
    const averagePaceSecPerKm = calculateAveragePaceSecPerKm(distanceRef.current, elapsedSeconds);
    const result: SoloRunResult = {
      averagePaceSecPerKm,
      currentPaceSecPerKm: stateRef.current.currentPaceSecPerKm,
      distanceMeters: Math.round(distanceRef.current),
      elapsedSeconds,
      finishedAt,
      lastPoint: routeRef.current[routeRef.current.length - 1],
      route: routeRef.current,
      startedAt: stateRef.current.startedAt,
    };
    patchState((current) => ({
      ...current,
      averagePaceSecPerKm,
      distanceMeters: result.distanceMeters,
      elapsedSeconds,
      finishedAt,
      status: "finished",
      trackingMessage: "Finished",
    }));
    return result;
  }, [calculateElapsedSeconds, patchState, stopLocation, stopTimer]);

  useEffect(
    () => () => {
      stopLocation();
      stopTimer();
    },
    [stopLocation, stopTimer],
  );

  return useMemo(
    () => ({
      finish,
      pause,
      resume,
      start,
      state,
    }),
    [finish, pause, resume, start, state],
  );
}
