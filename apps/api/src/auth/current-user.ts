import type { FastifyRequest } from "fastify";
import { loadConfig } from "../config.js";
import { DEV_USER_ID } from "./dev-user.js";
import { verifyToken } from "./token-service.js";

export interface CurrentUser {
  id: string;
}

export function getCurrentUser(request: FastifyRequest): CurrentUser {
  const config = loadConfig();
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    const payload = verifyToken(authorization.slice("Bearer ".length), "access");
    if (payload) {
      return { id: payload.sub };
    }
  }

  const headerUserId = request.headers["x-runmate-user-id"];
  if (!config.requireAuth && typeof headerUserId === "string" && headerUserId.length > 0) {
    return { id: headerUserId };
  }

  if (config.requireAuth) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  return { id: DEV_USER_ID };
}
