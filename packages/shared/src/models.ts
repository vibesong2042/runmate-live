export type UUID = string;
export type ISODateString = string;

export type AuthProvider = "email" | "apple" | "google";
export type UnitSystem = "metric" | "imperial";
export type Visibility = "private" | "friends";
export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";
export type SessionType = "solo" | "friend" | "group";
export type SessionStatus = "scheduled" | "ready" | "active" | "finished" | "cancelled";
export type ParticipantStatus =
  | "invited"
  | "joined"
  | "ready"
  | "running"
  | "paused"
  | "finished"
  | "left";
export type LiveRunState = "running" | "paused" | "finished" | "lost_signal";

export interface User {
  id: UUID;
  email: string;
  provider: AuthProvider;
  nickname: string;
  runnerId: string;
  profileImageUrl?: string;
  birthYear?: number;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  unit: UnitSystem;
  defaultPrivacy: Visibility;
  locationConsentAt?: ISODateString;
  marketingConsentAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deletedAt?: ISODateString;
}

export interface Friendship {
  id: UUID;
  requesterId: UUID;
  addresseeId: UUID;
  status: FriendshipStatus;
  createdAt: ISODateString;
  acceptedAt?: ISODateString;
  blockedAt?: ISODateString;
}

export interface RunningSession {
  id: UUID;
  hostUserId: UUID;
  title: string;
  type: SessionType;
  status: SessionStatus;
  targetDistanceMeters?: number;
  targetDurationSeconds?: number;
  scheduledStartAt?: ISODateString;
  startedAt?: ISODateString;
  endedAt?: ISODateString;
  locationSharingRequired: boolean;
  voiceFeedbackEnabled: boolean;
  visibility: "invited_only";
  createdAt: ISODateString;
}

export interface RunningSessionParticipant {
  id: UUID;
  sessionId: UUID;
  userId: UUID;
  status: ParticipantStatus;
  startedAt?: ISODateString;
  endedAt?: ISODateString;
  totalDistanceMeters: number;
  movingTimeSeconds: number;
  averagePaceSecPerKm?: number;
  currentPaceSecPerKm?: number;
  lastLocationAt?: ISODateString;
}

export interface LiveLocation {
  id: UUID;
  sessionId: UUID;
  userId: UUID;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracyMeters?: number;
  heading?: number;
  speedMps?: number;
  currentPaceSecPerKm?: number;
  averagePaceSecPerKm?: number;
  distanceMeters: number;
  state: LiveRunState;
  recordedAt: ISODateString;
  receivedAt: ISODateString;
}

export interface ActivityRecord {
  id: UUID;
  userId: UUID;
  sessionId?: UUID;
  distanceMeters: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  averagePaceSecPerKm: number;
  bestPaceSecPerKm?: number;
  maxSpeedMps?: number;
  caloriesEstimate?: number;
  routePolyline: string;
  mapSnapshotUrl?: string;
  visibility: Visibility;
  createdAt: ISODateString;
}

export interface Challenge {
  id: UUID;
  title: string;
  description: string;
  type: "distance" | "frequency" | "group_distance" | "pace";
  targetValue: number;
  startAt: ISODateString;
  endAt: ISODateString;
  visibility: "private" | "friends" | "public";
  createdByUserId?: UUID;
  createdAt: ISODateString;
}

export interface Achievement {
  id: UUID;
  code: string;
  title: string;
  description: string;
  iconUrl: string;
  conditionType: "first_run" | "distance_total" | "streak" | "group_runs" | "personal_best";
  conditionValue: number;
  createdAt: ISODateString;
}

export interface UserAchievement {
  id: UUID;
  userId: UUID;
  achievementId: UUID;
  earnedAt: ISODateString;
  sourceActivityId?: UUID;
}
