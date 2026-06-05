import type {
  ActivityRecord,
  Friendship,
  LiveLocation,
  RunningSession,
  RunningSessionParticipant,
  User,
} from "@runmate/shared";

export interface PrivacyConsent {
  id: string;
  userId: string;
  locationConsent: boolean;
  backgroundLocationConsent: boolean;
  marketingConsent: boolean;
  consentVersion: string;
  consentedAt: string;
}

export interface CreateSessionInput {
  hostUserId: string;
  title: string;
  type: RunningSession["type"];
  targetDistanceMeters?: number;
  targetDurationSeconds?: number;
  scheduledStartAt?: string;
  locationSharingRequired: boolean;
  voiceFeedbackEnabled: boolean;
  participantUserIds: string[];
}

export interface RunMateStore {
  createUser(input: Pick<User, "email" | "nickname" | "runnerId" | "provider">): Promise<User>;
  getUser(userId: string): Promise<User | undefined>;
  hasUser(userId: string): Promise<boolean>;
  getDevUser(): Promise<User | undefined>;
  updateDefaultPrivacy(userId: string, defaultPrivacy: User["defaultPrivacy"]): Promise<User | undefined>;
  searchUsersByRunnerId(runnerId: string): Promise<User[]>;

  recordPrivacyConsent(input: Omit<PrivacyConsent, "id" | "consentedAt">): Promise<PrivacyConsent>;
  listPrivacyConsents(userId: string): Promise<PrivacyConsent[]>;

  addFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
  listAcceptedFriendships(userId: string): Promise<Friendship[]>;
  listPendingFriendRequests(userId: string): Promise<Friendship[]>;
  getFriendship(friendshipId: string): Promise<Friendship | undefined>;
  updateFriendshipStatus(
    friendshipId: string,
    status: Extract<Friendship["status"], "accepted" | "declined">,
  ): Promise<Friendship | undefined>;

  createSession(input: CreateSessionInput): Promise<RunningSession>;
  listSessionsForUser(userId: string): Promise<RunningSession[]>;
  getSession(sessionId: string): Promise<RunningSession | undefined>;
  updateSessionParticipantStatus(
    sessionId: string,
    userId: string,
    status: RunningSessionParticipant["status"],
  ): Promise<RunningSessionParticipant | undefined>;
  updateSessionStatus(
    sessionId: string,
    status: Extract<RunningSession["status"], "active" | "finished">,
    timestamp: string,
  ): Promise<RunningSession | undefined>;
  getSessionParticipants(sessionId: string): Promise<RunningSessionParticipant[]>;

  upsertLiveLocation(location: LiveLocation): Promise<void>;
  listLatestLocations(sessionId: string): Promise<LiveLocation[]>;

  listActivities(userId: string): Promise<ActivityRecord[]>;
  createActivitiesForSession(sessionId: string): Promise<ActivityRecord[]>;
}
