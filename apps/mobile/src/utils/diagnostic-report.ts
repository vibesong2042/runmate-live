import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Network from "expo-network";
import {
  API_URL,
  ENABLE_NATIVE_MAP,
  NATIVE_MAP_API_KEY_CONFIGURED,
  RUNTIME_ENV,
  WS_URL,
} from "../config/runtime";
import { getLastSentryEventId } from "../monitoring/sentry";
import { loadLastApiDiagnostic } from "../storage/api-diagnostics";
import { loadLiveRunDiagnostics } from "../storage/live-run-diagnostics";
import type { PendingRunResult } from "../storage/pending-run-results";
import { loadVirtualRunHistory } from "../storage/virtual-run-history";

export interface DiagnosticReportAuthStatus {
  hasSession: boolean;
  userId?: string;
  runnerId?: string;
  isDemoMode: boolean;
}

export async function buildDiagnosticReport({
  authStatus,
  pendingResults,
}: {
  authStatus?: DiagnosticReportAuthStatus;
  pendingResults: PendingRunResult[];
}): Promise<string> {
  const [networkState, diagnostics, lastApi, virtualHistory] = await Promise.all([
    Network.getNetworkStateAsync().catch(() => undefined),
    loadLiveRunDiagnostics(),
    loadLastApiDiagnostic(),
    authStatus?.userId ? loadVirtualRunHistory(authStatus.userId) : Promise.resolve([]),
  ]);
  const generatedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const version = Constants.expoConfig?.version ?? "unknown";
  const buildProfile = ENABLE_NATIVE_MAP ? "preview-map" : "preview";
  const model = Device.modelName ?? Device.deviceName ?? "unknown";
  const os = `${Device.osName ?? "unknown"} ${Device.osVersion ?? ""}${
    Device.platformApiLevel ? ` (API ${Device.platformApiLevel})` : ""
  }`.trim();
  const lastVirtualRun = virtualHistory[0];

  return [
    "[RunMate Diagnostic Report]",
    `Generated: ${generatedAt} KST`,
    "",
    "--- App ---",
    `Version: ${version}`,
    `Build Profile: ${buildProfile}`,
    `Environment: ${RUNTIME_ENV}`,
    "",
    "--- Device ---",
    `Model: ${model}`,
    `OS: ${os}`,
    `Network: ${networkState?.type ?? "unknown"} / ${networkState?.isConnected ? "connected" : "disconnected"}`,
    "",
    "--- Network & Server ---",
    `API URL: ${API_URL}`,
    `WS URL: ${WS_URL}`,
    `Map Mode: ${ENABLE_NATIVE_MAP ? "native-google" : "fallback"}`,
    `Map Key Configured: ${NATIVE_MAP_API_KEY_CONFIGURED}`,
    "",
    "--- Session ---",
    `Runner ID: ${authStatus?.runnerId ?? "not signed in"}`,
    `Demo Mode: ${authStatus?.isDemoMode ? "true" : "false"}`,
    `WebSocket State: ${diagnostics?.syncStatus ?? "no run yet"}`,
    `WS Reconnect Count: ${diagnostics?.reconnectAttempt ?? 0}`,
    `Last WS Close Code: ${diagnostics?.lastWsCloseCode ?? "none"}`,
    `Last Sync: ${formatDateTime(diagnostics?.lastSyncedAt)}`,
    "",
    "--- GPS (recent 5 points) ---",
    `accuracy: ${formatSamples(diagnostics?.gpsAccuracySamples, "m")}`,
    `speed: ${formatSamples(diagnostics?.speedSamples, "m/s")}`,
    `Pending GPS Count: ${diagnostics?.pendingLocationUpdates ?? 0}`,
    `Accepted Points: ${diagnostics?.acceptedPointCount ?? 0}`,
    `Rejected Points: ${diagnostics?.rejectedPointCount ?? 0}`,
    "",
    "--- Pending Saves ---",
    `Pending Result Count: ${pendingResults.length}`,
    `Auto Retry Disabled Count: ${pendingResults.filter((result) => result.autoRetryDisabled).length}`,
    "",
    "--- Virtual Course ---",
    `Last Course: ${lastVirtualRun?.course.id ?? "none"}`,
    `Last Progress: ${lastVirtualRun ? `${Math.round(lastVirtualRun.progressPercent)}%` : "none"}`,
    `Last Save Status: ${lastVirtualRun?.saveStatus ?? "none"}`,
    `Last Virtual Run Time: ${formatDateTime(lastVirtualRun?.completedAt)}`,
    "",
    "--- Errors ---",
    `Sentry Last Event ID: ${getLastSentryEventId()}`,
    `Last API Path: ${lastApi?.path ?? "none"}`,
    `Last HTTP Status: ${lastApi?.status ?? "none"}`,
    `Last API Reason: ${lastApi?.reason ?? "none"}`,
    `Last API Time: ${formatDateTime(lastApi?.updatedAt)}`,
  ].join("\n");
}

function formatSamples(values: number[] | undefined, unit: string): string {
  if (!values?.length) {
    return "none";
  }
  return values.map((value) => `${Number(value).toFixed(unit === "m" ? 0 : 1)}${unit}`).join(", ");
}

function formatDateTime(value?: string): string {
  return value ? value.slice(0, 19).replace("T", " ") : "none";
}
