import { ApiError } from "../api/client";

export type AppErrorKind =
  | "network"
  | "timeout"
  | "auth"
  | "forbidden"
  | "rate_limit"
  | "server"
  | "input"
  | "websocket"
  | "unknown";

export interface ClassifiedAppError {
  kind: AppErrorKind;
  message: string;
  presentation: "toast" | "modal" | "inline";
  path?: string;
  status?: number;
  reason?: string;
}

export function classifyApiError(error: unknown, fallbackMessage: string): ClassifiedAppError {
  if (!(error instanceof ApiError)) {
    return {
      kind: "unknown",
      message: fallbackMessage,
      presentation: "toast",
    };
  }

  if (error.status === 0) {
    const reason = error.detail?.reason ?? error.message;
    const isTimeout = /abort|timeout|timed out/i.test(reason);
    return {
      kind: isTimeout ? "timeout" : "network",
      message: isTimeout
        ? "Server is not responding. Try again in a moment."
        : "Check your internet connection.",
      path: error.path,
      presentation: "toast",
      reason,
      status: error.status,
    };
  }
  if (error.status === 401) {
    return {
      kind: "auth",
      message: "Sign-in expired. Please sign in again.",
      path: error.path,
      presentation: "modal",
      reason: error.message,
      status: error.status,
    };
  }
  if (error.status === 403) {
    return {
      kind: "forbidden",
      message: "You cannot join or change this group.",
      path: error.path,
      presentation: "toast",
      reason: error.message,
      status: error.status,
    };
  }
  if (error.status === 429) {
    return {
      kind: "rate_limit",
      message: "Too many requests. Try again shortly.",
      path: error.path,
      presentation: "toast",
      reason: error.message,
      status: error.status,
    };
  }
  if (error.status === 400 || error.status === 422) {
    return {
      kind: "input",
      message: error.message || "Check the entered information.",
      path: error.path,
      presentation: "inline",
      reason: error.message,
      status: error.status,
    };
  }
  if (error.status >= 500) {
    return {
      kind: "server",
      message: "Server error. Try again in a moment.",
      path: error.path,
      presentation: "toast",
      reason: error.message,
      status: error.status,
    };
  }
  return {
    kind: "unknown",
    message: error.message || fallbackMessage,
    path: error.path,
    presentation: "toast",
    reason: error.message,
    status: error.status,
  };
}
