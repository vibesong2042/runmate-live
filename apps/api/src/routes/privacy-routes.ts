import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCurrentUser } from "../auth/current-user.js";
import { store } from "../store/index.js";

const consentSchema = z.object({
  locationConsent: z.boolean(),
  backgroundLocationConsent: z.boolean(),
  marketingConsent: z.boolean().default(false),
  consentVersion: z.string().min(1),
});

export async function registerPrivacyRoutes(app: FastifyInstance): Promise<void> {
  app.post("/privacy/location-consent", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const input = consentSchema.parse(request.body);
    const consent = await store.recordPrivacyConsent({
      userId: currentUser.id,
      ...input,
    });
    return reply.code(201).send({ consent });
  });

  app.get("/privacy/consents", async (request) => {
    const currentUser = getCurrentUser(request);
    return {
      consents: await store.listPrivacyConsents(currentUser.id),
    };
  });

  app.patch("/privacy/default-visibility", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const input = z.object({ defaultPrivacy: z.enum(["private", "friends"]) }).parse(request.body);
    const user = await store.updateDefaultPrivacy(currentUser.id, input.defaultPrivacy);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }
    return reply.send({ user });
  });
}
