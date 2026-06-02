import type { LiveRunState, UUID } from "./models.js";

export type ClientRealtimeEvent =
  | LocationUpdateEvent
  | ParticipantReadyEvent
  | CheerSendEvent
  | SessionControlEvent;

export type ServerRealtimeEvent =
  | ParticipantLocationEvent
  | ParticipantStatusEvent
  | CheerReceivedEvent
  | SessionLifecycleEvent;

export interface LocationUpdateEvent {
  type: "location:update";
  sessionId: UUID;
  payload: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracyMeters?: number;
    heading?: number;
    speedMps?: number;
    distanceMeters: number;
    currentPaceSecPerKm?: number;
    averagePaceSecPerKm?: number;
    state: LiveRunState;
    recordedAt: string;
  };
}

export interface ParticipantReadyEvent {
  type: "participant:ready";
  sessionId: UUID;
  payload: {
    ready: boolean;
  };
}

export interface CheerSendEvent {
  type: "cheer:send";
  sessionId: UUID;
  payload: {
    targetUserId: UUID;
    cheerCode: "nice" | "keep_pace" | "last_km" | "push" | "almost_there" | "great_finish";
  };
}

export interface SessionControlEvent {
  type: "session:control";
  sessionId: UUID;
  payload: {
    action: "start" | "pause" | "resume" | "finish";
  };
}

export interface ParticipantLocationEvent {
  type: "participant:location";
  sessionId: UUID;
  userId: UUID;
  payload: LocationUpdateEvent["payload"] & {
    lastUpdatedAt: string;
  };
}

export interface ParticipantStatusEvent {
  type: "participant:status";
  sessionId: UUID;
  userId: UUID;
  payload: {
    status: "joined" | "ready" | "running" | "paused" | "finished" | "lost_signal";
    updatedAt: string;
  };
}

export interface CheerReceivedEvent {
  type: "cheer:received";
  sessionId: UUID;
  userId: UUID;
  payload: {
    fromUserId: UUID;
    targetUserId: UUID;
    cheerCode: CheerSendEvent["payload"]["cheerCode"];
    sentAt: string;
  };
}

export interface SessionLifecycleEvent {
  type: "session:lifecycle";
  sessionId: UUID;
  payload: {
    status: "started" | "paused" | "resumed" | "finished" | "cancelled";
    updatedAt: string;
  };
}
