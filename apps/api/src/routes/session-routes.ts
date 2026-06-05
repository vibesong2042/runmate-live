import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Friendship, RunningSession, RunningSessionParticipant, User } from "@runmate/shared";
import { getCurrentUser } from "../auth/current-user.js";
import { store } from "../store/index.js";
import { broadcastToSession } from "../realtime/live-run-gateway.js";

const createSessionSchema = z.object({
  title: z.string().min(1).max(80),
  type: z.enum(["solo", "friend", "group"]),
  targetDistanceMeters: z.number().int().positive().optional(),
  targetDurationSeconds: z.number().int().positive().optional(),
  scheduledStartAt: z.string().datetime().optional(),
  friendUserIds: z.array(z.string()).default([]),
  locationSharingRequired: z.boolean().default(true),
  voiceFeedbackEnabled: z.boolean().default(true),
});

export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/running-sessions/invitations", async (request) => {
    const currentUser = getCurrentUser(request);
    const sessions = (await store.listSessionsForUser(currentUser.id)).filter(
      (session) =>
        session.hostUserId !== currentUser.id && session.status !== "finished" && session.status !== "cancelled",
    );
    const invitations = await Promise.all(sessions.map((session) => buildSessionResponse(session)));
    return { invitations };
  });

  app.post("/running-sessions", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const input = createSessionSchema.parse(request.body);
    const participantUserIds = [...new Set(input.friendUserIds)].filter((userId) => userId !== currentUser.id);
    const acceptedFriendIds = new Set(
      (await store.listAcceptedFriendships(currentUser.id))
        .map((friendship) => getFriendId(friendship, currentUser.id))
        .filter((friendId): friendId is string => Boolean(friendId)),
    );
    const invalidFriendIds = participantUserIds.filter((userId) => !acceptedFriendIds.has(userId));
    if (invalidFriendIds.length) {
      return reply.code(403).send({ message: "Only accepted friends can be invited to a running session" });
    }

    const session = await store.createSession({
      hostUserId: currentUser.id,
      title: input.title,
      type: input.type,
      targetDistanceMeters: input.targetDistanceMeters,
      targetDurationSeconds: input.targetDurationSeconds,
      scheduledStartAt: input.scheduledStartAt,
      locationSharingRequired: input.locationSharingRequired,
      voiceFeedbackEnabled: input.voiceFeedbackEnabled,
      participantUserIds,
    });
    return reply.code(201).send(await buildSessionResponse(session));
  });

  app.get("/running-sessions/:sessionId", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const params = request.params as { sessionId: string };
    const session = await store.getSession(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    const participants = await store.getSessionParticipants(session.id);
    if (!isParticipant(participants, currentUser.id)) {
      return reply.code(403).send({ message: "You are not a participant in this running session" });
    }
    return reply.send(await buildSessionResponse(session, participants));
  });

  app.post("/running-sessions/:sessionId/join", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const params = request.params as { sessionId: string };
    const session = await store.getSession(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    const participants = await store.getSessionParticipants(session.id);
    if (!isParticipant(participants, currentUser.id)) {
      return reply.code(403).send({ message: "You are not invited to this running session" });
    }
    const timestamp = new Date().toISOString();
    const participant = await store.updateSessionParticipantStatus(session.id, currentUser.id, "joined");
    if (participant) {
      broadcastToSession(session.id, {
        type: "participant:status",
        sessionId: session.id,
        userId: currentUser.id,
        payload: { status: "joined", updatedAt: timestamp },
      });
    }
    return reply.send(await buildSessionResponse(session));
  });

  app.post("/running-sessions/:sessionId/start", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const params = request.params as { sessionId: string };
    const timestamp = new Date().toISOString();
    const existingSession = await store.getSession(params.sessionId);
    if (!existingSession) {
      return reply.code(404).send({ message: "Session not found" });
    }
    if (existingSession.hostUserId !== currentUser.id) {
      return reply.code(403).send({ message: "Only the host can start this running session" });
    }
    const session = await store.updateSessionStatus(params.sessionId, "active", timestamp);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    broadcastToSession(session.id, {
      type: "session:lifecycle",
      sessionId: session.id,
      payload: { status: "started", updatedAt: timestamp },
    });
    return reply.send(await buildSessionResponse(session));
  });

  app.post("/running-sessions/:sessionId/finish", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const params = request.params as { sessionId: string };
    const timestamp = new Date().toISOString();
    const existingSession = await store.getSession(params.sessionId);
    if (!existingSession) {
      return reply.code(404).send({ message: "Session not found" });
    }
    const participants = await store.getSessionParticipants(existingSession.id);
    if (!isParticipant(participants, currentUser.id)) {
      return reply.code(403).send({ message: "You are not a participant in this running session" });
    }
    const session = await store.updateSessionStatus(params.sessionId, "finished", timestamp);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    const activities = await store.createActivitiesForSession(session.id);
    broadcastToSession(session.id, {
      type: "session:lifecycle",
      sessionId: session.id,
      payload: { status: "finished", updatedAt: timestamp },
    });
    return reply.send({
      session,
      participants: await store.getSessionParticipants(session.id),
      participantSummaries: (await buildSessionResponse(session)).participantSummaries,
      activities,
    });
  });
}

function getFriendId(friendship: Friendship, currentUserId: string): string | undefined {
  if (friendship.requesterId === currentUserId) {
    return friendship.addresseeId;
  }
  if (friendship.addresseeId === currentUserId) {
    return friendship.requesterId;
  }
  return undefined;
}

function isParticipant(participants: RunningSessionParticipant[], userId: string): boolean {
  return participants.some((participant) => participant.userId === userId);
}

async function buildSessionResponse(session: RunningSession, existingParticipants?: RunningSessionParticipant[]) {
  const participants = existingParticipants ?? (await store.getSessionParticipants(session.id));
  const participantSummaries = await Promise.all(
    participants.map(async (participant) => {
      const user = await store.getUser(participant.userId);
      return toParticipantSummary(participant, user, session.hostUserId);
    }),
  );
  return { session, participants, participantSummaries };
}

function toParticipantSummary(participant: RunningSessionParticipant, user: User | undefined, hostUserId: string) {
  return {
    participantId: participant.id,
    userId: participant.userId,
    nickname: user?.nickname ?? "Runner",
    runnerId: user?.runnerId,
    isHost: participant.userId === hostUserId,
    status: participant.status,
    totalDistanceMeters: participant.totalDistanceMeters,
    movingTimeSeconds: participant.movingTimeSeconds,
    averagePaceSecPerKm: participant.averagePaceSecPerKm,
    currentPaceSecPerKm: participant.currentPaceSecPerKm,
    lastLocationAt: participant.lastLocationAt,
  };
}
