import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";

test("require auth mode rejects REST requests without a bearer token", async () => {
  const previousRequireAuth = process.env.REQUIRE_AUTH;
  process.env.REQUIRE_AUTH = "true";
  const app = await buildApp({ logger: false });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/me",
    });
    assert.equal(response.statusCode, 401);
  } finally {
    if (previousRequireAuth === undefined) {
      delete process.env.REQUIRE_AUTH;
    } else {
      process.env.REQUIRE_AUTH = previousRequireAuth;
    }
    await app.close();
  }
});

test("runner can create a session, upload location, and finish with an activity", async () => {
  const app = await buildApp({ logger: false });
  try {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: {},
    });
    assert.equal(login.statusCode, 200);
    const loginBody = login.json<{ accessToken: string; user: { id: string } }>();
    assert.ok(loginBody.accessToken);

    const refreshed = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { "content-type": "application/json" },
      payload: { refreshToken: login.json<{ refreshToken: string }>().refreshToken },
    });
    assert.equal(refreshed.statusCode, 200);
    assert.ok(refreshed.json<{ accessToken: string }>().accessToken);

    const headers = {
      authorization: `Bearer ${loginBody.accessToken}`,
      "content-type": "application/json",
    };

    const me = await app.inject({
      method: "GET",
      url: "/me",
      headers,
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json<{ user: { id: string } }>().user.id, loginBody.user.id);

    const friends = await app.inject({
      method: "GET",
      url: "/friends",
      headers,
    });
    assert.equal(friends.statusCode, 200);
    const friendsBody = friends.json<{ friends: unknown[]; friendships: unknown[] }>();
    assert.ok(Array.isArray(friendsBody.friends));
    assert.ok(Array.isArray(friendsBody.friendships));

    const created = await app.inject({
      method: "POST",
      url: "/running-sessions",
      headers,
      payload: {
        title: "Test 5K",
        type: "group",
        targetDistanceMeters: 5000,
        friendUserIds: [],
        locationSharingRequired: true,
        voiceFeedbackEnabled: true,
      },
    });
    assert.equal(created.statusCode, 201);
    const createdBody = created.json<{ session: { id: string }; participants: unknown[] }>();
    assert.equal(createdBody.participants.length, 1);

    const sessionId = createdBody.session.id;
    const started = await app.inject({
      method: "POST",
      url: `/running-sessions/${sessionId}/start`,
      headers,
      payload: {},
    });
    assert.equal(started.statusCode, 200);

    const location = await app.inject({
      method: "POST",
      url: `/running-sessions/${sessionId}/locations`,
      headers,
      payload: {
        latitude: 37.5665,
        longitude: 126.978,
        accuracyMeters: 8,
        distanceMeters: 1200,
        averagePaceSecPerKm: 360,
        currentPaceSecPerKm: 350,
        state: "running",
        recordedAt: new Date().toISOString(),
      },
    });
    assert.equal(location.statusCode, 201);

    const finished = await app.inject({
      method: "POST",
      url: `/running-sessions/${sessionId}/finish`,
      headers,
      payload: {},
    });
    assert.equal(finished.statusCode, 200);
    const finishedBody = finished.json<{ activities: unknown[]; participants: unknown[] }>();
    assert.equal(finishedBody.participants.length, 1);
    assert.equal(finishedBody.activities.length, 1);
  } finally {
    await app.close();
  }
});

test("two development users can connect with a friend invite code", async () => {
  const app = await buildApp({ logger: false });
  try {
    const firstLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: { runnerId: "runner_alpha", nickname: "Runner Alpha" },
    });
    assert.equal(firstLogin.statusCode, 200);
    const first = firstLogin.json<{ accessToken: string; user: { id: string } }>();

    const secondLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: { runnerId: "runner_beta", nickname: "Runner Beta" },
    });
    assert.equal(secondLogin.statusCode, 200);
    const second = secondLogin.json<{ accessToken: string; user: { id: string } }>();
    assert.notEqual(first.user.id, second.user.id);

    const invite = await app.inject({
      method: "POST",
      url: "/invites/friend-link",
      headers: {
        authorization: `Bearer ${first.accessToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    assert.equal(invite.statusCode, 201);
    const inviteBody = invite.json<{ inviteCode: string }>();
    assert.ok(inviteBody.inviteCode);

    const accepted = await app.inject({
      method: "POST",
      url: "/invites/friend-link/accept",
      headers: {
        authorization: `Bearer ${second.accessToken}`,
        "content-type": "application/json",
      },
      payload: { inviteCode: inviteBody.inviteCode },
    });
    assert.equal(accepted.statusCode, 201);

    const firstFriends = await app.inject({
      method: "GET",
      url: "/friends",
      headers: { authorization: `Bearer ${first.accessToken}` },
    });
    assert.equal(firstFriends.statusCode, 200);
    assert.equal(firstFriends.json<{ friends: unknown[] }>().friends.length, 1);

    const secondFriends = await app.inject({
      method: "GET",
      url: "/friends",
      headers: { authorization: `Bearer ${second.accessToken}` },
    });
    assert.equal(secondFriends.statusCode, 200);
    assert.equal(secondFriends.json<{ friends: unknown[] }>().friends.length, 1);
  } finally {
    await app.close();
  }
});
