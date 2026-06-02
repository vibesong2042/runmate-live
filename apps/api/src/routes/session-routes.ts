import type { FastifyInstance } from "fastify";
import { z } from "zod";
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
  app.post("/running-sessions", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const input = createSessionSchema.parse(request.body);
    const session = await store.createSession({
      hostUserId: currentUser.id,
      title: input.title,
      type: input.type,
      targetDistanceMeters: input.targetDistanceMeters,
      targetDurationSeconds: input.targetDurationSeconds,
      scheduledStartAt: input.scheduledStartAt,
      locationSharingRequired: input.locationSharingRequired,
      voiceFeedbackEnabled: input.voiceFeedbackEnabled,
      participantUserIds: input.friendUserIds,
    });
    return reply.code(201).send({
      session,
      participants: await store.getSessionParticipants(session.id),
    });
  });

  app.get("/running-sessions/:sessionId", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const session = await store.getSession(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    return reply.send({
      session,
      participants: await store.getSessionParticipants(session.id),
    });
  });

  app.post("/running-sessions/:sessionId/start", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const timestamp = new Date().toISOString();
    const session = await store.updateSessionStatus(params.sessionId, "active", timestamp);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    broadcastToSession(session.id, {
      type: "session:lifecycle",
      sessionId: session.id,
      payload: { status: "started", updatedAt: timestamp },
    });
    return reply.send({ session });
  });

  app.post("/running-sessions/:sessionId/finish", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const timestamp = new Date().toISOString();
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
      activities,
    });
  });
}
