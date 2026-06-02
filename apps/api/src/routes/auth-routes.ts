import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCurrentUser } from "../auth/current-user.js";
import { issueTokens, verifyToken } from "../auth/token-service.js";
import { store } from "../store/index.js";

const signupSchema = z.object({
  email: z.string().email(),
  nickname: z.string().min(2).max(30),
  runnerId: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  provider: z.enum(["email", "apple", "google"]).default("email"),
});

const devLoginSchema = z
  .object({
    runnerId: z
      .string()
      .min(3)
      .max(24)
      .regex(/^[a-zA-Z0-9_]+$/)
      .optional(),
    nickname: z.string().min(2).max(30).optional(),
  })
  .default({});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/signup", async (request, reply) => {
    const input = signupSchema.parse(request.body);
    const user = await store.createUser(input);
    const tokens = issueTokens(user.id);
    return reply.code(201).send({
      user,
      ...tokens,
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const input = devLoginSchema.parse(request.body ?? {});
    const runnerId = input.runnerId ?? "runner";
    const user =
      runnerId === "runner"
        ? await store.getDevUser()
        : (await store.searchUsersByRunnerId(runnerId)).find((candidate) => candidate.runnerId === runnerId) ??
          (await store.createUser({
            email: `${runnerId.toLowerCase()}@example.com`,
            provider: "email",
            nickname: input.nickname ?? runnerId,
            runnerId,
          }));
    if (!user) {
      return reply.code(500).send({ message: "Development user could not be created" });
    }
    const tokens = issueTokens(user.id);
    return reply.send({
      user,
      ...tokens,
    });
  });

  app.post("/auth/refresh", async (request, reply) => {
    const input = z.object({ refreshToken: z.string().min(1) }).parse(request.body);
    const payload = verifyToken(input.refreshToken, "refresh");
    if (!payload || !(await store.hasUser(payload.sub))) {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }

    return reply.send(issueTokens(payload.sub));
  });

  app.get("/me", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const user = await store.getUser(currentUser.id);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }
    return reply.send({ user });
  });
}
