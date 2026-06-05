import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  calculateAveragePaceSecPerKm,
  calculateCurrentPaceSecPerKm,
  haversineDistanceMeters,
  shouldAcceptLocation,
  type CheerSendEvent,
  type ClientRealtimeEvent,
  type GeoPoint,
  type PaceSample,
  type ServerRealtimeEvent,
} from "@runmate/shared";
import { LiveRunSocket, type LiveRunSocketStatus } from "../api/live-run-socket";

interface UseLiveRunTrackerOptions {
  sessionId: string;
  userId: string;
  accessToken: string;
}

export interface LiveRunTrackerState {
  permissionStatus: "unknown" | "granted" | "denied";
  syncStatus: "idle" | "demo" | LiveRunSocketStatus;
  syncMessage?: string;
  pendingLocationUpdates: number;
  lastSyncedAt?: string;
  isTracking: boolean;
  elapsedSeconds: number;
  distanceMeters: number;
  currentPaceSecPerKm?: number;
  averagePaceSecPerKm?: number;
  accuracyMeters?: number;
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

export interface RemoteParticipantLocation {
  userId: string;
  latitude: number;
  longitude: number;
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

export function useLiveRunTracker({ sessionId, userId, accessToken }: UseLiveRunTrackerOptions) {
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
    pendingLocationUpdates: 0,
  });
  const startedAtRef = useRef<number | undefined>(undefined);
  const previousPointRef = useRef<GeoPoint | undefined>(undefined);
  const distanceRef = useRef(0);
  const samplesRef = useRef<PaceSample[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const socketRef = useRef<LiveRunSocket | undefined>(undefined);
  const pendingLocationRef = useRef<ClientRealtimeEvent | undefined>(undefined);

  const flushPendingLocation = useCallback(() => {
    const pending = pendingLocationRef.current;
    if (!pending || !socketRef.current?.send(pending)) {
      return;
    }

    pendingLocationRef.current = undefined;
    setState((current) => ({
      ...current,
      lastSyncedAt: new Date().toISOString(),
      pendingLocationUpdates: 0,
      syncMessage: "Latest route point synced after reconnect",
    }));
  }, []);

  const handleRealtimeEvent = useCallback(
    (event: ServerRealtimeEvent) => {
      if (event.sessionId !== sessionId) {
        return;
      }

      if (event.type === "participant:location" && event.userId !== userId) {
        setState((current) => ({
          ...current,
          remoteLocations: {
            ...current.remoteLocations,
            [event.userId]: {
              userId: event.userId,
              latitude: event.payload.latitude,
              longitude: event.payload.longitude,
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
        setState((current) => ({
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
        setState((current) => ({
          ...current,
          latestCheer: cheer,
          receivedCheers: [cheer, ...current.receivedCheers].slice(0, 20),
        }));
      }
    },
    [sessionId, userId],
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
    pendingLocationRef.current = undefined;
    if (accessToken === "demo-access-token") {
      socketRef.current = undefined;
    } else {
      socketRef.current = new LiveRunSocket();
      socketRef.current.connect({
        accessToken,
        sessionId,
        onEvent: handleRealtimeEvent,
        onStatus: (update) => {
          setState((current) => ({
            ...current,
            syncStatus: update.status,
            syncMessage: update.message,
            pendingLocationUpdates: pendingLocationRef.current ? 1 : 0,
          }));
          if (update.status === "open") {
            flushPendingLocation();
          }
        },
      });
    }

    setState({
      permissionStatus: "granted",
      syncStatus: accessToken === "demo-access-token" ? "demo" : "connecting",
      isTracking: true,
      elapsedSeconds: 0,
      distanceMeters: 0,
      remoteLocations: {},
      participantStatuses: {},
      receivedCheers: [],
      sentCheers: 0,
      pendingLocationUpdates: 0,
      syncMessage: accessToken === "demo-access-token" ? "Demo mode is local only" : "Opening live sync",
      latestCheer: undefined,
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

      const locationEvent: ClientRealtimeEvent = {
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
      };
      const locationSent = accessToken === "demo-access-token" ? true : socketRef.current?.send(locationEvent) === true;
      if (!locationSent) {
        pendingLocationRef.current = locationEvent;
      }

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
        lastSyncedAt: locationSent ? recordedAt : current.lastSyncedAt,
        pendingLocationUpdates: pendingLocationRef.current ? 1 : 0,
        syncMessage: locationSent
          ? current.syncMessage
          : "Latest route point is saved on this phone until live sync reconnects",
      }));
    });
  }, [accessToken, flushPendingLocation, handleRealtimeEvent, sessionId]);

  const sendCheer = useCallback(
    (targetUserId: string, cheerCode: CheerSendEvent["payload"]["cheerCode"] = "nice") => {
      if (accessToken === "demo-access-token") {
        setState((current) => ({ ...current, sentCheers: current.sentCheers + 1 }));
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
        setState((current) => ({ ...current, sentCheers: current.sentCheers + 1 }));
      } else {
        setState((current) => ({
          ...current,
          syncMessage: "Cheer was not sent because live sync is reconnecting",
        }));
      }
      return Boolean(sent);
    },
    [accessToken, sessionId],
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
