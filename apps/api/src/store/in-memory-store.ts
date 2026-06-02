import { randomUUID } from "node:crypto";
import type {
  ActivityRecord,
  Friendship,
  LiveLocation,
  RunningSession,
  RunningSessionParticipant,
  User,
} from "@runmate/shared";
import { calculateAveragePaceSecPerKm } from "@runmate/shared";
import { DEV_USER_ID } from "../auth/dev-user.js";
import type { CreateSessionInput, PrivacyConsent, RunMateStore } from "./store-types.js";

export class InMemoryStore implements RunMateStore {
  readonly users = new Map<string, User>();
  readonly friendships = new Map<string, Friendship>();
  readonly sessions = new Map<string, RunningSession>();
  readonly participants = new Map<string, RunningSessionParticipant>();
  readonly liveLocations = new Map<string, LiveLocation[]>();
  readonly activities = new Map<string, ActivityRecord>();
  readonly privacyConsents = new Map<string, PrivacyConsent[]>();

  constructor() {
    const now = new Date().toISOString();
    this.users.set(DEV_USER_ID, {
      id: DEV_USER_ID,
      email: "runner@example.com",
      provider: "email",
      nickname: "Runner",
      runnerId: "runner",
      unit: "metric",
      defaultPrivacy: "friends",
      locationConsentAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  async createUser(input: Pick<User, "email" | "nickname" | "runnerId" | "provider">): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      email: input.email,
      provider: input.provider,
      nickname: input.nickname,
      runnerId: input.runnerId,
      unit: "metric",
      defaultPrivacy: "friends",
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUser(userId: string): Promise<User | undefined> {
    return this.users.get(userId);
  }

  async hasUser(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }

  async getDevUser(): Promise<User | undefined> {
    return this.users.get(DEV_USER_ID);
  }

  async updateDefaultPrivacy(userId: string, defaultPrivacy: User["defaultPrivacy"]): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }
    user.defaultPrivacy = defaultPrivacy;
    user.updatedAt = new Date().toISOString();
    return user;
  }

  async searchUsersByRunnerId(runnerId: string): Promise<User[]> {
    return [...this.users.values()].filter((user) => user.runnerId.toLowerCase().includes(runnerId.toLowerCase()));
  }

  async recordPrivacyConsent(input: Omit<PrivacyConsent, "id" | "consentedAt">): Promise<PrivacyConsent> {
    const consent: PrivacyConsent = {
      ...input,
      id: randomUUID(),
      consentedAt: new Date().toISOString(),
    };
    const consents = this.privacyConsents.get(input.userId) ?? [];
    consents.push(consent);
    this.privacyConsents.set(input.userId, consents);

    const user = this.users.get(input.userId);
    if (user) {
      user.locationConsentAt = input.locationConsent ? consent.consentedAt : undefined;
      user.marketingConsentAt = input.marketingConsent ? consent.consentedAt : undefined;
      user.updatedAt = consent.consentedAt;
    }

    return consent;
  }

  async listPrivacyConsents(userId: string): Promise<PrivacyConsent[]> {
    return this.privacyConsents.get(userId) ?? [];
  }

  async addFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const now = new Date().toISOString();
    const friendship: Friendship = {
      id: randomUUID(),
      requesterId,
      addresseeId,
      status: "pending",
      createdAt: now,
    };
    this.friendships.set(friendship.id, friendship);
    return friendship;
  }

  async listAcceptedFriendships(userId: string): Promise<Friendship[]> {
    return [...this.friendships.values()].filter(
      (item) => item.status === "accepted" && (item.requesterId === userId || item.addresseeId === userId),
    );
  }

  async listPendingFriendRequests(userId: string): Promise<Friendship[]> {
    return [...this.friendships.values()].filter((item) => item.addresseeId === userId && item.status === "pending");
  }

  async getFriendship(friendshipId: string): Promise<Friendship | undefined> {
    return this.friendships.get(friendshipId);
  }

  async updateFriendshipStatus(
    friendshipId: string,
    status: Extract<Friendship["status"], "accepted" | "declined">,
  ): Promise<Friendship | undefined> {
    const friendship = this.friendships.get(friendshipId);
    if (!friendship) {
      return undefined;
    }
    friendship.status = status;
    friendship.acceptedAt = status === "accepted" ? new Date().toISOString() : friendship.acceptedAt;
    return friendship;
  }

  async createSession(input: CreateSessionInput): Promise<RunningSession> {
    const now = new Date().toISOString();
    const session: RunningSession = {
      id: randomUUID(),
      hostUserId: input.hostUserId,
      title: input.title,
      type: input.type,
      status: input.scheduledStartAt ? "scheduled" : "ready",
      targetDistanceMeters: input.targetDistanceMeters,
      targetDurationSeconds: input.targetDurationSeconds,
      scheduledStartAt: input.scheduledStartAt,
      locationSharingRequired: input.locationSharingRequired,
      voiceFeedbackEnabled: input.voiceFeedbackEnabled,
      visibility: "invited_only",
      createdAt: now,
    };
    this.sessions.set(session.id, session);

    const participantIds = new Set([input.hostUserId, ...input.participantUserIds]);
    for (const userId of participantIds) {
      const participant: RunningSessionParticipant = {
        id: randomUUID(),
        sessionId: session.id,
        userId,
        status: userId === input.hostUserId ? "joined" : "invited",
        totalDistanceMeters: 0,
        movingTimeSeconds: 0,
      };
      this.participants.set(participant.id, participant);
    }

    return session;
  }

  async getSession(sessionId: string): Promise<RunningSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async updateSessionStatus(
    sessionId: string,
    status: Extract<RunningSession["status"], "active" | "finished">,
    timestamp: string,
  ): Promise<RunningSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    session.status = status;
    if (status === "active") {
      session.startedAt = timestamp;
    }
    if (status === "finished") {
      session.endedAt = timestamp;
    }
    return session;
  }

  async getSessionParticipants(sessionId: string): Promise<RunningSessionParticipant[]> {
    return [...this.participants.values()].filter((participant) => participant.sessionId === sessionId);
  }

  async upsertLiveLocation(location: LiveLocation): Promise<void> {
    const key = `${location.sessionId}:${location.userId}`;
    const locations = this.liveLocations.get(key) ?? [];
    locations.push(location);
    this.liveLocations.set(key, locations.slice(-1200));

    const participant = [...this.participants.values()].find(
      (item) => item.sessionId === location.sessionId && item.userId === location.userId,
    );
    if (participant) {
      participant.status = location.state === "lost_signal" ? "running" : location.state;
      participant.totalDistanceMeters = location.distanceMeters;
      participant.averagePaceSecPerKm = location.averagePaceSecPerKm;
      participant.currentPaceSecPerKm = location.currentPaceSecPerKm;
      participant.lastLocationAt = location.recordedAt;
    }
  }

  async listLatestLocations(sessionId: string): Promise<LiveLocation[]> {
    return [...this.liveLocations.entries()]
      .filter(([key]) => key.startsWith(`${sessionId}:`))
      .map(([, locations]) => locations[locations.length - 1])
      .filter(Boolean);
  }

  async listActivities(userId: string): Promise<ActivityRecord[]> {
    return [...this.activities.values()].filter((activity) => activity.userId === userId);
  }

  async createActivitiesForSession(sessionId: string): Promise<ActivityRecord[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const endedAt = session.endedAt ?? new Date().toISOString();
    const startedAt = session.startedAt ?? session.createdAt;
    const durationSeconds = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000));

    const participants = await this.getSessionParticipants(sessionId);
    return participants
      .filter((participant) => participant.totalDistanceMeters > 0)
      .map((participant) => {
        const movingTimeSeconds = participant.movingTimeSeconds || durationSeconds;
        const averagePaceSecPerKm =
          participant.averagePaceSecPerKm ??
          calculateAveragePaceSecPerKm(participant.totalDistanceMeters, movingTimeSeconds) ??
          0;
        const activity: ActivityRecord = {
          id: randomUUID(),
          userId: participant.userId,
          sessionId,
          distanceMeters: participant.totalDistanceMeters,
          durationSeconds,
          movingTimeSeconds,
          averagePaceSecPerKm,
          routePolyline: "",
          visibility: "friends",
          createdAt: endedAt,
        };
        this.activities.set(activity.id, activity);
        return activity;
      });
  }
}

export const store = new InMemoryStore();
