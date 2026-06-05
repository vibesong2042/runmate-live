import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 15000;

function readApiUrlFromMobileEnv() {
  try {
    const envPath = path.resolve("apps", "mobile", ".env");
    const env = readFileSync(envPath, "utf8");
    const line = env
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.startsWith("EXPO_PUBLIC_API_URL="));
    return line?.split("=").slice(1).join("=").trim();
  } catch {
    return undefined;
  }
}

function normalizeApiUrl(value) {
  if (!value) {
    throw new Error("Missing API URL. Pass one as the first argument or set apps/mobile/.env EXPO_PUBLIC_API_URL.");
  }
  return value.replace(/\/+$/, "");
}

function wsUrlFromApiUrl(apiUrl) {
  if (apiUrl.startsWith("https://")) {
    return `wss://${apiUrl.slice("https://".length)}/ws`;
  }
  if (apiUrl.startsWith("http://")) {
    return `ws://${apiUrl.slice("http://".length)}/ws`;
  }
  throw new Error(`Unsupported API URL protocol: ${apiUrl}`);
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForWebSocket(url) {
  if (typeof WebSocket === "undefined") {
    throw new Error("This check requires Node.js with global WebSocket support.");
  }

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("WebSocket connection timed out."));
    }, DEFAULT_TIMEOUT_MS);

    socket.onopen = () => {
      clearTimeout(timeout);
      socket.close();
      resolve();
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket connection failed."));
    };
  });
}

async function main() {
  const apiUrl = normalizeApiUrl(process.argv[2] ?? process.env.EXPO_PUBLIC_API_URL ?? readApiUrlFromMobileEnv());
  const wsBaseUrl = process.argv[3]?.replace(/\/+$/, "") ?? wsUrlFromApiUrl(apiUrl);
  const runnerId = `check${Date.now().toString().slice(-10)}`;

  const health = await fetchJson(`${apiUrl}/health`);
  const login = await fetchJson(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runnerId, nickname: "Beta Check" }),
  });

  const session = await fetchJson(`${apiUrl}/running-sessions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${login.accessToken}`,
    },
    body: JSON.stringify({
      title: "Beta API Check",
      type: "group",
      targetDistanceMeters: 1000,
      friendUserIds: [],
      locationSharingRequired: true,
      voiceFeedbackEnabled: false,
    }),
  });

  const socketUrl = `${wsBaseUrl}?token=${encodeURIComponent(login.accessToken)}&sessionId=${encodeURIComponent(
    session.session.id,
  )}`;
  await waitForWebSocket(socketUrl);

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl,
        wsUrl: wsBaseUrl,
        health,
        runnerId,
        sessionId: session.session.id,
        checks: ["health", "login", "session", "websocket"],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
