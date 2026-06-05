import type { FastifyInstance } from "fastify";
import { getCurrentUser } from "../auth/current-user.js";
import { store } from "../store/index.js";

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/activities", async (request) => {
    const currentUser = getCurrentUser(request);
    const activities = (await store.listActivities(currentUser.id)).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    return { activities };
  });

  app.get("/running-sessions/:sessionId/results", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const params = request.params as { sessionId: string };
    const session = await store.getSession(params.sessionId);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    const participants = await store.getSessionParticipants(session.id);
    if (!participants.some((participant) => participant.userId === currentUser.id)) {
      return reply.code(403).send({ message: "You are not a participant in this running session" });
    }
    return reply.send({
      session,
      participants,
    });
  });
}
