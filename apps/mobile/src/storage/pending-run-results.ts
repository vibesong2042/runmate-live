import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RunResultSummary } from "../screens/ResultScreen";

const STORAGE_KEY = "runmate.pendingRunResults.v1";

export interface PendingRunResult {
  id: string;
  userId: string;
  sessionId: string;
  result: RunResultSummary;
  createdAt: string;
  retryCount?: number;
  lastRetryAt?: string;
  lastError?: string;
  autoRetryDisabled?: boolean;
}

export async function loadPendingRunResults(userId?: string): Promise<PendingRunResult[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const entries = JSON.parse(raw) as PendingRunResult[];
    return userId ? entries.filter((entry) => entry.userId === userId) : entries;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export async function savePendingRunResult(entry: PendingRunResult): Promise<void> {
  const entries = await loadPendingRunResults();
  const withoutDuplicate = entries.filter((item) => item.id !== entry.id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...withoutDuplicate].slice(0, 10)));
}

export async function updatePendingRunResult(entry: PendingRunResult): Promise<void> {
  await savePendingRunResult(entry);
}

export async function removePendingRunResult(id: string): Promise<void> {
  const entries = await loadPendingRunResults();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries.filter((entry) => entry.id !== id)));
}
