const DEFAULT_API_URL = "http://localhost:4000";

export const RUNTIME_ENV = process.env.EXPO_PUBLIC_RUNTIME_ENV ?? "development";
export const API_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL);
export const WS_URL = normalizeWebSocketUrl(process.env.EXPO_PUBLIC_WS_URL, API_URL);
export const ENABLE_DEMO_FALLBACK = process.env.EXPO_PUBLIC_ENABLE_DEMO_FALLBACK === "true";

export type NetworkScope = "local-device" | "private-lan" | "public" | "unknown";

export function getApiNetworkScope(url = API_URL): NetworkScope {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host === "::1" || host.startsWith("127.")) {
      return "local-device";
    }
    if (host.startsWith("192.168.") || host.startsWith("10.") || isPrivate172Host(host)) {
      return "private-lan";
    }
    return "public";
  } catch {
    return "unknown";
  }
}

export function getApiTargetLabel(): string {
  const scope = getApiNetworkScope();
  if (scope === "local-device") {
    return `${API_URL} (this phone only)`;
  }
  if (scope === "private-lan") {
    return `${API_URL} (same Wi-Fi only)`;
  }
  if (scope === "public") {
    return `${API_URL} (public test API)`;
  }
  return `${API_URL} (check URL)`;
}

export function buildApiConnectionHelp(reason: string): string {
  const scope = getApiNetworkScope();
  const base = `Could not reach ${API_URL}. ${reason}`;

  if (scope === "local-device") {
    return `${base} On a real phone, localhost points to the phone, not your computer. Use your computer LAN IP for local testing or a public HTTPS API URL for outside testing.`;
  }

  if (scope === "private-lan") {
    return `${base} This is a same-Wi-Fi address. For friends on mobile data or another Wi-Fi, set EXPO_PUBLIC_API_URL to a public HTTPS API URL and EXPO_PUBLIC_WS_URL to its WSS /ws URL.`;
  }

  return `${base} Check that the API server is running, the URL is correct, and the server allows HTTPS/WSS traffic.`;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeWebSocketUrl(value: string | undefined, apiUrl: string): string {
  if (value?.trim()) {
    return value.trim().replace(/\/+$/, "");
  }
  return `${apiUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:")}/ws`;
}

function isPrivate172Host(host: string): boolean {
  const match = /^172\.(\d{1,2})\./.exec(host);
  if (!match) {
    return false;
  }
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}
