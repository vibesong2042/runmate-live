import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "runmate.liveRunDiagnostics.v1";

export interface LiveRunDiagnostics {
  syncStatus: string;
  syncMessage?: string;
  reconnectAttempt: number;
  pendingLocationUpdates: number;
  lastSyncedAt?: string;
  gpsAccuracyMeters?: number;
  speedMps?: number;
  trackingQuality: string;
  acceptedPointCount: number;
  rejectedPointCount: number;
  updatedAt: string;
}

export async function loadLiveRunDiagnostics(): Promise<LiveRunDiagnostics | undefined> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as LiveRunDiagnostics;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
}

export async function saveLiveRunDiagnostics(diagnostics: LiveRunDiagnostics): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(diagnostics));
}
