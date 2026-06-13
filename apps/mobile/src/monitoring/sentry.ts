import React from "react";
import * as Sentry from "@sentry/react-native";
import { RUNTIME_ENV, SENTRY_DSN, SENTRY_ENABLED } from "../config/runtime";

let initialized = false;
let lastSentryEventId: string | undefined;

export function initializeSentry(): void {
  if (initialized || !SENTRY_ENABLED || !SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: RUNTIME_ENV,
    sendDefaultPii: false,
  });
  initialized = true;
}

export function captureDiagnosticError(): string {
  if (!SENTRY_ENABLED) {
    return "Sentry is disabled because EXPO_PUBLIC_SENTRY_DSN is not set.";
  }

  lastSentryEventId = Sentry.captureException(new Error("RunMate Live Sentry diagnostic test"));
  return "Sentry test error sent. Check the Sentry project dashboard.";
}

export function addDiagnosticBreadcrumb(message: string): void {
  if (!SENTRY_ENABLED) {
    return;
  }
  Sentry.addBreadcrumb({
    category: "diagnostics",
    level: "info",
    message,
  });
}

export function getLastSentryEventId(): string {
  return lastSentryEventId ?? (SENTRY_ENABLED ? "none" : "disabled");
}

export function withSentry<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  if (!SENTRY_ENABLED) {
    return Component;
  }
  return Sentry.wrap(Component as React.ComponentType<Record<string, unknown>>) as React.ComponentType<P>;
}
