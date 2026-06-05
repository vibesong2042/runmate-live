import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { registerLiveRunGateway } from "./realtime/live-run-gateway.js";
import { registerActivityRoutes } from "./routes/activity-routes.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerFriendRoutes } from "./routes/friend-routes.js";
import { registerLocationRoutes } from "./routes/location-routes.js";
import { registerPrivacyRoutes } from "./routes/privacy-routes.js";
import { registerSessionRoutes } from "./routes/session-routes.js";

export async function buildApp(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const config = loadConfig();
  const app = Fastify({ logger: options.logger ?? true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: "Validation failed",
        issues: error.issues,
      });
    }

    const httpError = error as { statusCode?: number; message?: string };
    if (typeof httpError.statusCode === "number" && httpError.statusCode < 500) {
      return reply.code(httpError.statusCode).send({ message: httpError.message ?? "Request failed" });
    }

    app.log.error(error);
    return reply.code(500).send({ message: "Internal server error" });
  });

  await app.register(cors, { origin: config.corsOrigin });
  await app.register(websocket);

  app.get("/health", async () => ({
    ok: true,
    runtimeEnv: config.runtimeEnv,
    storeDriver: config.storeDriver,
  }));

  await registerAuthRoutes(app);
  await registerPrivacyRoutes(app);
  await registerFriendRoutes(app);
  await registerSessionRoutes(app);
  await registerLocationRoutes(app);
  await registerActivityRoutes(app);
  await registerLiveRunGateway(app);

  return app;
}
