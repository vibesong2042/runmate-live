import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type {
  CheerSendEvent,
  ClientRealtimeEvent,
  LocationUpdateEvent,
  ParticipantLocationEvent,
} from "@runmate/shared";
import { DEV_USER_ID } from "../auth/dev-user.js";
import { verifyToken } from "../auth/token-service.js";
import { loadConfig } from "../config.js";
import { store } from "../store/index.js";

type SessionId = string;
type UserId = string;

interface LiveSocket {
  readonly OPEN: number;
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message", listener: (raw: unknown) => void): void;
  on(event: "close", listener: () => void): void;
}

interface ClientConnection {
  id: string;
  userId: UserId;
  sessionIds: Set<SessionId>;
  socket: LiveSocket;
}

const clients = new Map<string, ClientConnection>();

function send(socket: LiveSocket, event: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

export function broadcastToSession(sessionId: string, event: unknown): void {
  for (const client of clients.values()) {
    if (client.sessionIds.has(sessionId)) {
      send(client.socket, event);
    }
  }
}

function parseMessage(raw: unknown): ClientRealtimeEvent | undefined {
  try {
    const text = typeof raw === "string" ? raw : String(raw);
    return JSON.parse(text) as ClientRealtimeEvent;
  } catch {
    return undefined;
  }
}

async function handleLocationUpdate(userId: string, event: LocationUpdateEvent): Promise<void> {
  if (!(await isSessionParticipant(event.sessionId, userId))) {
    return;
  }

  const now = new Date().toISOString();
  await store.upsertLiveLocation({
    id: randomUUID(),
    sessionId: event.sessionId,
    userId,
    latitude: event.payload.latitude,
    longitude: event.payload.longitude,
    altitude: event.payload.altitude,
    accuracyMeters: event.payload.accuracyMeters,
    heading: event.payload.heading,
    speedMps: event.payload.speedMps,
    currentPaceSecPerKm: event.payload.currentPaceSecPerKm,
    averagePaceSecPerKm: event.payload.averagePaceSecPerKm,
    distanceMeters: event.payload.distanceMeters,
    state: event.payload.state,
    recordedAt: event.payload.recordedAt,
    receivedAt: now,
  });

  const outbound: ParticipantLocationEvent = {
    type: "participant:location",
    sessionId: event.sessionId,
    userId,
    payload: {
      ...event.payload,
      lastUpdatedAt: now,
    },
  };
  broadcastToSession(event.sessionId, outbound);
}

async function handleCheer(userId: string, event: CheerSendEvent): Promise<void> {
  if (!(await isSessionParticipant(event.sessionId, userId))) {
    return;
  }

  broadcastToSession(event.sessionId, {
    type: "cheer:received",
    sessionId: event.sessionId,
    userId: event.payload.targetUserId,
    payload: {
      fromUserId: userId,
      targetUserId: event.payload.targetUserId,
      cheerCode: event.payload.cheerCode,
      sentAt: new Date().toISOString(),
    },
  });
}

async function isSessionParticipant(sessionId: string, userId: string): Promise<boolean> {
  const participants = await store.getSessionParticipants(sessionId);
  return participants.some((participant) => participant.userId === userId);
}

export async function registerLiveRunGateway(app: FastifyInstance): Promise<void> {
  app.get("/ws", { websocket: true }, (socket, request) => {
    const config = loadConfig();
    const query = request.query as { userId?: string; sessionId?: string; token?: string };
    const tokenPayload = query.token ? verifyToken(query.token, "access") : undefined;
    const liveSocket = socket as LiveSocket;

    if (config.requireAuth && !tokenPayload) {
      send(liveSocket, { type: "error", payload: { message: "Unauthorized" } });
      liveSocket.close(1008, "Unauthorized");
      return;
    }

    const connection: ClientConnection = {
      id: randomUUID(),
      userId: tokenPayload?.sub ?? (!config.requireAuth ? query.userId : undefined) ?? DEV_USER_ID,
      sessionIds: new Set(query.sessionId ? [query.sessionId] : []),
      socket: liveSocket,
    };
    clients.set(connection.id, connection);

    send(liveSocket, {
      type: "connection:ready",
      payload: {
        connectionId: connection.id,
      },
    });

    socket.on("message", (raw: unknown) => {
      const event = parseMessage(raw);
      if (!event) {
        send(liveSocket, { type: "error", payload: { message: "Invalid JSON event" } });
        return;
      }

      connection.sessionIds.add(event.sessionId);

      if (event.type === "location:update") {
        void handleLocationUpdate(connection.userId, event);
      }

      if (event.type === "cheer:send") {
        void handleCheer(connection.userId, event);
      }
    });

    socket.on("close", () => {
      clients.delete(connection.id);
    });
  });
}
