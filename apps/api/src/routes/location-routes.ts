import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "../auth/current-user.js";
import { broadcastToSession } from "../realtime/live-run-gateway.js";
import { store } from "../store/index.js";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracyMeters: z.number().nonnegative().optional(),
  heading: z.number().min(0).max(360).optional(),
  speedMps: z.number().nonnegative().optional(),
  distanceMeters: z.number().nonnegative(),
  currentPaceSecPerKm: z.number().positive().optional(),
  averagePaceSecPerKm: z.number().positive().optional(),
  state: z.enum(["running", "paused", "finished", "lost_signal"]),
  recordedAt: z.string().datetime(),
});

export async function registerLocationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/running-sessions/:sessionId/locations", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const params = request.params as { sessionId: string };
    const input = locationSchema.parse(request.body);
    const receivedAt = new Date().toISOString();
    const location = {
      id: randomUUID(),
      sessionId: params.sessionId,
      userId: currentUser.id,
      ...input,
      receivedAt,
    };
    await store.upsertLiveLocation(location);
    broadcastToSession(params.sessionId, {
      type: "participant:location",
      sessionId: params.sessionId,
      userId: currentUser.id,
      payload: {
        ...input,
        lastUpdatedAt: receivedAt,
      },
    });
    return reply.code(201).send({ location });
  });

  app.get("/running-sessions/:sessionId/locations/latest", async (request) => {
    const params = request.params as { sessionId: string };
    const latest = await store.listLatestLocations(params.sessionId);
    return { locations: latest };
  });
}
