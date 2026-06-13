import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  assessLocationForRunning,
  calculateAveragePaceSecPerKm,
  calculateCurrentPaceSecPerKm,
  type CheerSendEvent,
  type ClientRealtimeEvent,
  type GeoPoint,
  type LocationRejectReason,
  type PaceSample,
  type ServerRealtimeEvent,
} from "@runmate/shared";
import { LiveRunSocket, type LiveRunSocketStatus } from "../api/live-run-socket";
import {
  clearLiveLocationBuffer,
  loadLiveLocationBuffer,
  saveLiveLocationBuffer,
} from "../storage/live-location-buffer";
import { saveLiveRunDiagnostics } from "../storage/live-run-diagnostics";

interface UseLiveRunTrackerOptions {
  sessionId: string;
  userId: string;
  accessToken: string;
  getAccessToken: () => Promise<string>;
}

export interface LiveRunTrackerState {
  permissionStatus: "unknown" | "granted" | "denied";
  syncStatus: "idle" | "demo" | LiveRunSocketStatus;
  syncMessage?: string;
  trackingQuality: TrackingQuality;
  lastRejectedLocationReason?: LocationRejectReason;
  acceptedPointCount: number;
  rejectedPointCount: number;
  pendingLocationUpdates: number;
  reconnectAttempt: number;
  lastWsCloseCode?: number;
  lastSyncedAt?: string;
  isTracking: boolean;
  elapsedSeconds: number;
  distanceMeters: number;
  currentPaceSecPerKm?: number;
  averagePaceSecPerKm?: number;
  accuracyMeters?: number;
  gpsAccuracySamples: number[];
  speedMps?: number;
  speedSamples: number[];
  latitude?: number;
  longitude?: number;
  lastLocationAt?: string;
  remoteLocations: Record<string, RemoteParticipantLocation>;
  participantStatuses: Record<string, RemoteParticipantStatus>;
  receivedCheers: ReceivedCheer[];
  sentCheers: number;
  latestCheer?: ReceivedCheer;
  error?: string;
}

export type TrackingQuality = "waiting" | "normal" | "weak_gps" | "too_fast" | "paused";

export interface RemoteParticipantLocation {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  speedMps?: number;
  distanceMeters: number;
  state: "running" | "paused" | "finished" | "lost_signal";
  currentPaceSecPerKm?: number;
  averagePaceSecPerKm?: number;
  lastUpdatedAt: string;
}

export interface RemoteParticipantStatus {
  status: "joined" | "ready" | "running" | "paused" | "finished" | "lost_signal";
  updatedAt: string;
}

export interface ReceivedCheer {
  id: string;
  fromUserId: string;
  targetUserId: string;
  cheerCode: CheerSendEvent["payload"]["cheerCode"];
  sentAt: string;
}

const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 5,
};

const TOO_FAST_ANCHOR_RESET_THRESHOLD = 3;

export function useLiveRunTracker({ sessionId, userId, accessToken, getAccessToken }: UseLiveRunTrackerOptions) {
  const [state, setState] = useState<LiveRunTrackerState>({
    permissionStatus: "unknown",
    syncStatus: "idle",
    isTracking: false,
    elapsedSeconds: 0,
    distanceMeters: 0,
    remoteLocations: {},
    participantStatuses: {},
    receivedCheers: [],
    sentCheers: 0,
    trackingQuality: "waiting",
    acceptedPointCount: 0,
    rejectedPointCount: 0,
    pendingLocationUpdates: 0,
    reconnectAttempt: 0,
    gpsAccuracySamples: [],
    speedSamples: [],
  });
  const startedAtRef = useRef<number | undefined>(undefined);
  const acceptedPointRef = useRef<GeoPoint | undefined>(undefined);
  const tooFastRejectionStreakRef = useRef(0);
  const distanceRef = useRef(0);
  const samplesRef = useRef<PaceSample[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const socketRef = useRef<LiveRunSocket | undefined>(undefined);
  const pendingLocationQueueRef = useRef<ClientRealtimeEvent[]>([]);
  const isFlushingPendingLocationsRef = useRef(false);

  const persistDiagnostics = useCallback((nextState: LiveRunTrackerState) => {
    void saveLiveRunDiagnostics({
      acceptedPointCount: nextState.acceptedPointCount,
      gpsAccuracyMeters: nextState.accuracyMeters,
      gpsAccuracySamples: nextState.gpsAccuracySamples,
      lastSyncedAt: nextState.lastSyncedAt,
      lastWsCloseCode: nextState.lastWsCloseCode,
      pendingLocationUpdates: nextState.pendingLocationUpdates,
      reconnectAttempt: nextState.reconnectAttempt,
      rejectedPointCount: nextState.rejectedPointCount,
      speedMps: nextState.speedMps,
      speedSamples: nextState.speedSamples,
      syncMessage: nextState.syncMessage,
      syncStatus: nextState.syncStatus,
      trackingQuality: nextState.trackingQuality,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const patchState = useCallback(
    (updater: (current: LiveRunTrackerState) => LiveRunTrackerState) => {
      setState((current) => {
        const next = updater(current);
        persistDiagnostics(next);
        return next;
      });
    },
    [persistDiagnostics],
  );

  const flushPendingLocations = useCallback(async () => {
    if (isFlushingPendingLocationsRef.current || !pendingLocationQueueRef.current.length) {
      return;
    }

    isFlushingPendingLocationsRef.current = true;
    try {
      const remaining = [...pendingLocationQueueRef.current];
      let lastSyncedAt: string | undefined;

      while (remaining.length) {
        const event = remaining[0];
        if (!socketRef.current?.send(event)) {
          break;
        }
        remaining.shift();
        lastSyncedAt = new Date().toISOString();
      }

      pendingLocationQueueRef.current = remaining;
      if (remaining.length) {
        await saveLiveLocationBuffer(sessionId, userId, remaining);
      } else {
        await clearLiveLocationBuffer(sessionId, userId);
      }
      patchState((current) => ({
        ...current,
        lastSyncedAt: lastSyncedAt ?? current.lastSyncedAt,
        pendingLocationUpdates: remaining.length,
        syncMessage: remaining.length
          ? "Some route points are still waiting to sync"
          : "Buffered route points synced after reconnect",
      }));
    } finally {
      isFlushingPendingLocationsRef.current = false;
    }
  }, [patchState, sessionId, userId]);

  const handleRealtimeEvent = useCallback(
    (event: ServerRealtimeEvent) => {
      if (event.sessionId !== sessionId) {
        return;
      }

      if (event.type === "participant:location" && event.userId !== userId) {
        patchState((current) => ({
          ...current,
          remoteLocations: {
            ...current.remoteLocations,
            [event.userId]: {
              userId: event.userId,
              latitude: event.payload.latitude,
              longitude: event.payload.longitude,
              accuracyMeters: event.payload.accuracyMeters,
              speedMps: event.payload.speedMps,
              distanceMeters: event.payload.distanceMeters,
              state: event.payload.state,
              currentPaceSecPerKm: event.payload.currentPaceSecPerKm,
              averagePaceSecPerKm: event.payload.averagePaceSecPerKm,
              lastUpdatedAt: event.payload.lastUpdatedAt,
            },
          },
        }));
      }

      if (event.type === "participant:status") {
        patchState((current) => ({
          ...current,
          participantStatuses: {
            ...current.participantStatuses,
            [event.userId]: {
              status: event.payload.status,
              updatedAt: event.payload.updatedAt,
            },
          },
        }));
      }

      if (event.type === "cheer:received" && event.payload.targetUserId === userId) {
        const cheer: ReceivedCheer = {
          id: `${event.payload.fromUserId}-${event.payload.sentAt}-${event.payload.cheerCode}`,
          fromUserId: event.payload.fromUserId,
          targetUserId: event.payload.targetUserId,
          cheerCode: event.payload.cheerCode,
          sentAt: event.payload.sentAt,
        };
        patchState((current) => ({
          ...current,
          latestCheer: cheer,
          receivedCheers: [cheer, ...current.receivedCheers].slice(0, 20),
        }));
      }
    },
    [patchState, sessionId, userId],
  );

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = undefined;
    socketRef.current?.close();
    socketRef.current = undefined;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    patchState((current) => ({ ...current, isTracking: false }));
  }, [patchState]);

  const handleLocationUpdate = useCallback(
    async (location: Location.LocationObject) => {
      const recordedAt = new Date(location.timestamp).toISOString();
      const nextPoint: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude ?? undefined,
        accuracyMeters: location.coords.accuracy ?? undefined,
        recordedAt,
      };

      const previous = acceptedPointRef.current;
      const assessment = assessLocationForRunning(previous, nextPoint);
      const acceptedPointIncrement = assessment.accepted ? 1 : 0;
      const rejectedPointIncrement = assessment.accepted ? 0 : 1;
      let trackingQuality: TrackingQuality = "normal";
      let lastRejectedLocationReason: LocationRejectReason | undefined;

      if (assessment.accepted) {
        distanceRef.current += assessment.distanceMeters ?? 0;
        acceptedPointRef.current = nextPoint;
        tooFastRejectionStreakRef.current = 0;
      } else {
        lastRejectedLocationReason = assessment.reason;
        trackingQuality = trackingQualityForRejectReason(assessment.reason);

        if (assessment.reason === "too_fast") {
          tooFastRejectionStreakRef.current += 1;
          if (tooFastRejectionStreakRef.current >= TOO_FAST_ANCHOR_RESET_THRESHOLD) {
            acceptedPointRef.current = nextPoint;
          }
        } else {
          tooFastRejectionStreakRef.current = 0;
        }

        if (assessment.shouldResetAnchor) {
          acceptedPointRef.current = nextPoint;
          tooFastRejectionStreakRef.current = 0;
        }
      }

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
      const speedMps = location.coords.speed ?? assessment.speedMps;

      const locationEvent: ClientRealtimeEvent = {
        type: "location:update",
        sessionId,
        payload: {
          latitude: nextPoint.latitude,
          longitude: nextPoint.longitude,
          altitude: nextPoint.altitude,
          accuracyMeters: nextPoint.accuracyMeters,
          heading: location.coords.heading ?? undefined,
          speedMps,
          distanceMeters,
          currentPaceSecPerKm,
          averagePaceSecPerKm,
          state: "running",
          recordedAt,
        },
      };
      let locationSent = false;
      if (accessToken === "demo-access-token") {
        locationSent = true;
      } else if (pendingLocationQueueRef.current.length) {
        pendingLocationQueueRef.current = await saveLiveLocationBuffer(sessionId, userId, [
          ...pendingLocationQueueRef.current,
          locationEvent,
        ]);
        await flushPendingLocations();
        locationSent = pendingLocationQueueRef.current.length === 0;
      } else {
        locationSent = socketRef.current?.send(locationEvent) === true;
        if (!locationSent) {
          pendingLocationQueueRef.current = await saveLiveLocationBuffer(sessionId, userId, [
            ...pendingLocationQueueRef.current,
            locationEvent,
          ]);
        }
      }

      patchState((current) => ({
        ...current,
        elapsedSeconds,
        distanceMeters,
        currentPaceSecPerKm,
        averagePaceSecPerKm,
        trackingQuality,
        lastRejectedLocationReason,
        acceptedPointCount: current.acceptedPointCount + acceptedPointIncrement,
        rejectedPointCount: current.rejectedPointCount + rejectedPointIncrement,
        accuracyMeters: nextPoint.accuracyMeters,
        gpsAccuracySamples:
          nextPoint.accuracyMeters === undefined
            ? current.gpsAccuracySamples
            : [...current.gpsAccuracySamples, nextPoint.accuracyMeters].slice(-5),
        speedMps,
        speedSamples: speedMps === undefined ? current.speedSamples : [...current.speedSamples, speedMps].slice(-5),
        latitude: nextPoint.latitude,
        longitude: nextPoint.longitude,
        lastLocationAt: recordedAt,
        lastSyncedAt: locationSent ? recordedAt : current.lastSyncedAt,
        pendingLocationUpdates: pendingLocationQueueRef.current.length,
        syncMessage: locationSent
          ? current.syncMessage
          : "Route points are saved on this phone until live sync reconnects",
      }));
    },
    [accessToken, flushPendingLocations, patchState, sessionId, userId],
  );

  const start = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      patchState((current) => ({
        ...current,
        permissionStatus: "denied",
        error: "Location permission is required.",
      }));
      return;
    }

    startedAtRef.current = Date.now();
    acceptedPointRef.current = undefined;
    tooFastRejectionStreakRef.current = 0;
    distanceRef.current = 0;
    samplesRef.current = [];
    pendingLocationQueueRef.current = await loadLiveLocationBuffer(sessionId, userId);
    if (accessToken === "demo-access-token") {
      socketRef.current = undefined;
    } else {
      socketRef.current = new LiveRunSocket();
      socketRef.current.connect({
        getAccessToken,
        sessionId,
        onEvent: handleRealtimeEvent,
        onStatus: (update) => {
          patchState((current) => ({
            ...current,
            syncStatus: update.status,
            syncMessage: update.message,
            reconnectAttempt: update.attempt,
            lastWsCloseCode: update.closeCode ?? current.lastWsCloseCode,
            pendingLocationUpdates: pendingLocationQueueRef.current.length,
          }));
          if (update.status === "open") {
            void flushPendingLocations();
          }
        },
      });
    }

    const initialState: LiveRunTrackerState = {
      permissionStatus: "granted",
      syncStatus: accessToken === "demo-access-token" ? "demo" : "connecting",
      isTracking: true,
      elapsedSeconds: 0,
      distanceMeters: 0,
      remoteLocations: {},
      participantStatuses: {},
      receivedCheers: [],
      sentCheers: 0,
      trackingQuality: "waiting",
      lastRejectedLocationReason: undefined,
      acceptedPointCount: 0,
      rejectedPointCount: 0,
      pendingLocationUpdates: pendingLocationQueueRef.current.length,
      reconnectAttempt: 0,
      gpsAccuracySamples: [],
      speedSamples: [],
      syncMessage: accessToken === "demo-access-token" ? "Demo mode is local only" : "Opening live sync",
      latestCheer: undefined,
    };
    setState(initialState);
    persistDiagnostics(initialState);

    timerRef.current = setInterval(() => {
      if (!startedAtRef.current) {
        return;
      }
      patchState((current) => ({
        ...current,
        elapsedSeconds: Math.max(0, Math.round((Date.now() - startedAtRef.current!) / 1000)),
      }));
    }, 1000);

    subscriptionRef.current = await Location.watchPositionAsync(LOCATION_OPTIONS, (location) => {
      void handleLocationUpdate(location);
    });
  }, [
    accessToken,
    flushPendingLocations,
    getAccessToken,
    handleLocationUpdate,
    handleRealtimeEvent,
    patchState,
    persistDiagnostics,
    sessionId,
    userId,
  ]);

  const sendCheer = useCallback(
    (targetUserId: string, cheerCode: CheerSendEvent["payload"]["cheerCode"] = "nice") => {
      if (accessToken === "demo-access-token") {
        patchState((current) => ({ ...current, sentCheers: current.sentCheers + 1 }));
        return true;
      }

      const sent = socketRef.current?.send({
        type: "cheer:send",
        sessionId,
        payload: {
          targetUserId,
          cheerCode,
        },
      });
      if (sent) {
        patchState((current) => ({ ...current, sentCheers: current.sentCheers + 1 }));
      } else {
        patchState((current) => ({
          ...current,
          syncMessage: "Cheer was not sent because live sync is reconnecting",
        }));
      }
      return Boolean(sent);
    },
    [accessToken, patchState, sessionId],
  );

  useEffect(() => stop, [stop]);

  return useMemo(
    () => ({
      ...state,
      sendCheer,
      start,
      stop,
    }),
    [sendCheer, start, state, stop],
  );
}

function trackingQualityForRejectReason(reason?: LocationRejectReason): TrackingQuality {
  if (reason === "low_accuracy") {
    return "weak_gps";
  }
  if (reason === "too_fast") {
    return "too_fast";
  }
  if (reason === "stale_or_invalid_time") {
    return "paused";
  }
  return "normal";
}
