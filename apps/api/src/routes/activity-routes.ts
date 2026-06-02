import type { FastifyInstance } from "fastify";
import { getCurrentUser } from "../auth/current-user.js";
import { store } from "../store/index.js";

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/activities", async (request) => {
    const currentUser = getCurrentUser(request);
    const activities = await store.listActivities(currentUser.id);
    return { activities };
  });

  app.get("/running-sessions/:sessionId/results", async (request, reply) => {
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
}
