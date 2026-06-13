import type { ActivityRecord, LiveLocation, RunningSession, RunningSessionParticipant } from "@runmate/shared";
import { API_URL, ENABLE_DEMO_FALLBACK, buildApiConnectionHelp } from "../config/runtime";
import { saveLastApiDiagnostic } from "../storage/api-diagnostics";

export { API_URL } from "../config/runtime";

const REQUEST_TIMEOUT_MS = 8000;

export interface AuthSession {
  user: {
    id: string;
    nickname: string;
    runnerId: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface LoginProfile {
  runnerId: string;
  nickname: string;
}

export interface FriendSummaryDto {
  id: string;
  nickname: string;
  runnerId?: string;
  status: "online" | "running" | "offline";
  currentPace?: string;
}

export interface SessionParticipantSummaryDto {
  participantId: string;
  userId: string;
  nickname: string;
  runnerId?: string;
  isHost: boolean;
  status: RunningSessionParticipant["status"];
  totalDistanceMeters: number;
  movingTimeSeconds: number;
  averagePaceSecPerKm?: number;
  currentPaceSecPerKm?: number;
  lastLocationAt?: string;
}

export interface RunningSessionResponseDto {
  session: RunningSession;
  participants: RunningSessionParticipant[];
  participantSummaries?: SessionParticipantSummaryDto[];
}

export interface RunningSessionFinishResponseDto extends RunningSessionResponseDto {
  activities?: ActivityRecord[];
}

export interface RunningSessionInvitationsDto {
  invitations: RunningSessionResponseDto[];
}

export interface LatestLocationsDto {
  locations: LiveLocation[];
}

export interface ActivitiesResponseDto {
  activities: ActivityRecord[];
}

interface RequestOptions {
  accessToken?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  readonly detail?: { url?: string; reason?: string },
  ) {
    super(message);
  }
}

async function buildHttpError(method: string, path: string, response: Response): Promise<ApiError> {
  let reason = `${method} ${path} failed with ${response.status}`;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) {
      reason = body.message;
    }
  } catch {
    // Keep the status-based fallback when the API does not return JSON.
  }
  void saveLastApiDiagnostic({
    path,
    reason,
    status: response.status,
    url: `${API_URL}${path}`,
  });
  return new ApiError(reason, response.status, path, { url: `${API_URL}${path}`, reason });
}

async function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const url = `${API_URL}${path}`;
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    void saveLastApiDiagnostic({
      path,
      reason,
      status: 0,
      timeoutMs: /abort|timeout/i.test(reason) ? REQUEST_TIMEOUT_MS : undefined,
      url: `${API_URL}${path}`,
    });
    throw new ApiError(buildApiConnectionHelp(reason), 0, path, { url: `${API_URL}${path}`, reason });
  } finally {
    clearTimeout(timeout);
  }
}

function buildHeaders(options: RequestOptions = {}, hasBody = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers["content-type"] = "application/json";
  }
  if (options.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }
  return headers;
}

export async function loginDevUser(profile: LoginProfile): Promise<AuthSession> {
  return apiPost<AuthSession>("/auth/login", profile);
}

export async function refreshAuthSession(refreshToken: string): Promise<Pick<AuthSession, "accessToken" | "refreshToken">> {
  return apiPost<Pick<AuthSession, "accessToken" | "refreshToken">>("/auth/refresh", { refreshToken });
}

export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(path, {
      headers: buildHeaders(options),
    });
  } catch (error) {
    const demoResponse = ENABLE_DEMO_FALLBACK ? getDemoGetResponse<T>(path) : undefined;
    if (demoResponse) {
      return demoResponse;
    }
    throw error;
  }
  if (!response.ok) {
    throw await buildHttpError("GET", path, response);
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(path, {
      method: "POST",
      headers: buildHeaders(options, true),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const demoResponse = ENABLE_DEMO_FALLBACK ? getDemoPostResponse<T>(path, body) : undefined;
    if (demoResponse) {
      return demoResponse;
    }
    throw error;
  }
  if (!response.ok) {
    throw await buildHttpError("POST", path, response);
  }
  return response.json() as Promise<T>;
}

function getDemoPostResponse<T>(path: string, body?: unknown): T | undefined {
  const now = new Date().toISOString();
  const sessionId = `demo-session-${Date.now()}`;

  if (path === "/auth/login") {
    const profile = body as Partial<LoginProfile> | undefined;
    const runnerId = profile?.runnerId?.trim() || "runner";
    return {
      user: {
        id: `demo-${runnerId}`,
        nickname: profile?.nickname?.trim() || runnerId,
        runnerId,
      },
      accessToken: "demo-access-token",
      refreshToken: "demo-refresh-token",
    } as T;
  }

  if (path === "/invites/friend-link") {
    return {
      inviteCode: `DEMO-${Math.floor(100000 + Math.random() * 900000)}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    } as T;
  }

  if (path === "/invites/friend-link/accept") {
    return {
      friendship: {
        id: `demo-friendship-${Date.now()}`,
        requesterId: "demo-friend",
        addresseeId: "demo-user",
        status: "accepted",
        createdAt: now,
        acceptedAt: now,
      },
      friend: { id: "demo-friend", nickname: "Invited Runner", runnerId: "invited_runner", status: "online" },
    } as T;
  }

  if (path === "/auth/refresh") {
    return {
      accessToken: "demo-access-token",
      refreshToken: "demo-refresh-token",
    } as T;
  }

  if (path === "/running-sessions") {
    const request = body as { title?: string; type?: string; targetDistanceMeters?: number } | undefined;
    return {
      session: {
        id: sessionId,
        title: request?.title ?? "Remote 5K",
        type: request?.type ?? "group",
        hostUserId: "demo-user",
        status: "scheduled",
        targetDistanceMeters: request?.targetDistanceMeters ?? 5000,
        scheduledStartAt: now,
        startedAt: undefined,
        endedAt: undefined,
        createdAt: now,
        updatedAt: now,
      },
      participants: [
        {
          sessionId,
          userId: "demo-user",
          status: "ready",
          joinedAt: now,
          startedAt: undefined,
          finishedAt: undefined,
        },
      ],
      participantSummaries: [
        {
          participantId: "demo-participant",
          userId: "demo-user",
          nickname: "Demo Runner",
          runnerId: "demo_runner",
          isHost: true,
          status: "joined",
          totalDistanceMeters: 0,
          movingTimeSeconds: 0,
        },
      ],
    } as T;
  }

  if (/^\/running-sessions\/[^/]+\/join$/.test(path)) {
    return { ok: true } as T;
  }

  if (/^\/running-sessions\/[^/]+\/(start|finish)$/.test(path)) {
    return { ok: true } as T;
  }

  return undefined;
}

function getDemoGetResponse<T>(path: string): T | undefined {
  if (path === "/friends") {
    return {
      friends: [],
      friendships: [],
    } as T;
  }

  if (path === "/activities") {
    return {
      activities: getDemoActivities(),
    } as T;
  }

  if (path === "/running-sessions/invitations") {
    return { invitations: [] } as T;
  }

  if (/^\/running-sessions\/[^/]+$/.test(path)) {
    return {
      session: {
        id: "demo-session",
        title: "Remote 5K",
        type: "group",
        hostUserId: "demo-user",
        status: "active",
        targetDistanceMeters: 5000,
        locationSharingRequired: true,
        voiceFeedbackEnabled: true,
        visibility: "invited_only",
        createdAt: new Date().toISOString(),
      },
      participants: [],
      participantSummaries: [
        {
          participantId: "demo-participant",
          userId: "demo-user",
          nickname: "Demo Runner",
          runnerId: "demo_runner",
          isHost: true,
          status: "running",
          totalDistanceMeters: 0,
          movingTimeSeconds: 0,
        },
      ],
    } as T;
  }

  if (/^\/running-sessions\/[^/]+\/locations\/latest$/.test(path)) {
    return { locations: [] } as T;
  }

  return undefined;
}

function getDemoActivities(): ActivityRecord[] {
  const now = new Date();
  return [
    {
      id: "demo-activity-1",
      userId: "demo-user",
      sessionId: "demo-session-1",
      distanceMeters: 5000,
      durationSeconds: 1810,
      movingTimeSeconds: 1810,
      averagePaceSecPerKm: 362,
      routePolyline: "",
      visibility: "friends",
      createdAt: now.toISOString(),
    },
    {
      id: "demo-activity-2",
      userId: "demo-user",
      sessionId: "demo-session-2",
      distanceMeters: 3200,
      durationSeconds: 1180,
      movingTimeSeconds: 1180,
      averagePaceSecPerKm: 369,
      routePolyline: "",
      visibility: "friends",
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
