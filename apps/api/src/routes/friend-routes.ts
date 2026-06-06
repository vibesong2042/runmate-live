import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Friendship, User } from "@runmate/shared";
import { getCurrentUser } from "../auth/current-user.js";
import { store } from "../store/index.js";

const requestSchema = z.object({
  addresseeId: z.string().min(1),
});

const acceptInviteSchema = z.object({
  inviteCode: z.string().min(4).max(36),
});

export async function registerFriendRoutes(app: FastifyInstance): Promise<void> {
  app.get("/friends", async (request) => {
    const currentUser = getCurrentUser(request);
    const friendships = await store.listAcceptedFriendships(currentUser.id);
    const friends = (
      await Promise.all(
        friendships.map(async (friendship) => {
          const friendId = getFriendId(friendship, currentUser.id);
          const user = friendId ? await store.getUser(friendId) : undefined;
          return user ? toFriendSummary(user) : undefined;
        }),
      )
    ).filter((friend): friend is ReturnType<typeof toFriendSummary> => Boolean(friend));
    return { friends, friendships };
  });

  app.get("/friends/search", async (request) => {
    const query = request.query as { runnerId?: string };
    const users = query.runnerId ? await store.searchUsersByRunnerId(query.runnerId) : [];
    return { users };
  });

  app.post("/friends/requests", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const input = requestSchema.parse(request.body);
    if (!(await store.hasUser(input.addresseeId))) {
      return reply.code(404).send({ message: "Addressee not found" });
    }
    const friendship = await store.addFriendRequest(currentUser.id, input.addresseeId);
    return reply.code(201).send({ friendship });
  });

  app.get("/friends/requests", async (request) => {
    const currentUser = getCurrentUser(request);
    const requests = await store.listPendingFriendRequests(currentUser.id);
    return { requests };
  });

  app.post("/friends/requests/:requestId/accept", async (request, reply) => {
    const params = request.params as { requestId: string };
    const friendship = await store.updateFriendshipStatus(params.requestId, "accepted");
    if (!friendship) {
      return reply.code(404).send({ message: "Friend request not found" });
    }
    return reply.send({ friendship });
  });

  app.post("/friends/requests/:requestId/decline", async (request, reply) => {
    const params = request.params as { requestId: string };
    const friendship = await store.updateFriendshipStatus(params.requestId, "declined");
    if (!friendship) {
      return reply.code(404).send({ message: "Friend request not found" });
    }
    return reply.send({ friendship });
  });

  app.post("/invites/friend-link", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const inviteCode = await createInviteCode();
    const invite = await store.createFriendInvite({
      code: inviteCode,
      creatorUserId: currentUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return reply.code(201).send({
      inviteCode,
      expiresAt: invite.expiresAt,
    });
  });

  app.post("/invites/friend-link/accept", async (request, reply) => {
    const currentUser = getCurrentUser(request);
    const input = acceptInviteSchema.parse(request.body);
    const inviteCode = normalizeInviteCode(input.inviteCode);
    if (!inviteCode) {
      return reply.code(400).send({ message: "Invite code is required" });
    }

    const invite = await store.getFriendInvite(inviteCode);
    if (!invite) {
      return reply.code(404).send({ message: "Invite code not found" });
    }
    if (invite.revokedAt) {
      return reply.code(410).send({ message: "Invite code expired" });
    }
    if (Date.parse(invite.expiresAt) <= Date.now()) {
      return reply.code(410).send({ message: "Invite code expired" });
    }
    if (invite.creatorUserId === currentUser.id) {
      return reply.code(400).send({ message: "You cannot accept your own invite" });
    }

    const existing = (await store.listAcceptedFriendships(currentUser.id)).find(
      (friendship) => getFriendId(friendship, currentUser.id) === invite.creatorUserId,
    );
    if (existing) {
      await store.markFriendInviteAccepted(invite.code, currentUser.id, new Date().toISOString());
      const friend = await store.getUser(invite.creatorUserId);
      return reply.send({
        friendship: existing,
        friend: friend ? toFriendSummary(friend) : undefined,
      });
    }

    const accepted = await store.upsertAcceptedFriendship(invite.creatorUserId, currentUser.id);
    await store.markFriendInviteAccepted(invite.code, currentUser.id, new Date().toISOString());
    const friend = await store.getUser(invite.creatorUserId);
    return reply.code(201).send({
      friendship: accepted,
      friend: friend ? toFriendSummary(friend) : undefined,
    });
  });
}

async function createInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    if (!(await store.getFriendInvite(code))) {
      return code;
    }
  }
  return randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

function normalizeInviteCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
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

function toFriendSummary(user: User) {
  return {
    id: user.id,
    nickname: user.nickname,
    runnerId: user.runnerId,
    status: "online" as const,
  };
}
