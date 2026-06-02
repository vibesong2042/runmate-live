export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
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

interface RequestOptions {
  accessToken?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
  }
}

async function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(`Cannot reach API at ${API_URL}. ${reason}`, 0, path);
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
    const demoResponse = getDemoGetResponse<T>(path);
    if (demoResponse) {
      return demoResponse;
    }
    throw error;
  }
  if (!response.ok) {
    throw new ApiError(`GET ${path} failed with ${response.status}`, response.status, path);
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
    const demoResponse = getDemoPostResponse<T>(path, body);
    if (demoResponse) {
      return demoResponse;
    }
    throw error;
  }
  if (!response.ok) {
    throw new ApiError(`POST ${path} failed with ${response.status}`, response.status, path);
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
    } as T;
  }

  if (/^\/running-sessions\/[^/]+\/(start|finish)$/.test(path)) {
    return { ok: true } as T;
  }

  return undefined;
}

function getDemoGetResponse<T>(path: string): T | undefined {
  if (path === "/friends") {
    return {
      friends: getDemoFriends(),
      friendships: [],
    } as T;
  }

  return undefined;
}

function getDemoFriends(): FriendSummaryDto[] {
  return [
    { id: "friend-1", nickname: "Minsu", status: "running", currentPace: "5:48" },
    { id: "friend-2", nickname: "Jihyun", status: "online" },
    { id: "friend-3", nickname: "Seoyeon", status: "offline" },
  ];
}
