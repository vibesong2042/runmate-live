import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VirtualCourseProgress, VirtualRunHistoryEntry, VirtualRunResultSummary } from "../types/virtualCourse";

const HISTORY_STORAGE_KEY = "runmate.virtualRunHistory.v1";
const PROGRESS_STORAGE_KEY = "runmate.virtualCourseProgress.v1";
const MAX_HISTORY_ENTRIES = 30;

export async function loadVirtualRunHistory(userId: string): Promise<VirtualRunHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(buildHistoryStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const entries = JSON.parse(raw) as VirtualRunHistoryEntry[];
    return entries.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  } catch {
    await AsyncStorage.removeItem(buildHistoryStorageKey(userId));
    return [];
  }
}

export async function saveVirtualRunHistoryEntry(
  userId: string,
  result: VirtualRunResultSummary,
  options: {
    completedAt?: string;
    saveStatus?: VirtualRunHistoryEntry["saveStatus"];
    sessionId?: string;
  } = {},
): Promise<VirtualRunHistoryEntry> {
  const completedAt = options.completedAt ?? new Date().toISOString();
  const entry: VirtualRunHistoryEntry = {
    ...result,
    completedAt,
    id: `${result.course.id}-${Date.now()}`,
    saveStatus: options.saveStatus,
    sessionId: options.sessionId,
  };
  const entries = await loadVirtualRunHistory(userId);
  await AsyncStorage.setItem(
    buildHistoryStorageKey(userId),
    JSON.stringify([entry, ...entries].slice(0, MAX_HISTORY_ENTRIES)),
  );
  await saveVirtualCourseProgressFromEntry(userId, entry);
  return entry;
}

export async function updateVirtualRunHistorySaveStatus(
  userId: string,
  sessionId: string,
  saveStatus: VirtualRunHistoryEntry["saveStatus"],
): Promise<void> {
  const entries = await loadVirtualRunHistory(userId);
  const nextEntries = entries.map((entry) => (entry.sessionId === sessionId ? { ...entry, saveStatus } : entry));
  await AsyncStorage.setItem(buildHistoryStorageKey(userId), JSON.stringify(nextEntries.slice(0, MAX_HISTORY_ENTRIES)));
}

export async function loadVirtualCourseProgress(userId: string): Promise<Record<string, VirtualCourseProgress>> {
  const raw = await AsyncStorage.getItem(buildProgressStorageKey(userId));
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, VirtualCourseProgress>;
  } catch {
    await AsyncStorage.removeItem(buildProgressStorageKey(userId));
    return {};
  }
}

export async function saveVirtualCourseProgressFromEntry(userId: string, entry: VirtualRunHistoryEntry): Promise<void> {
  const progress = await loadVirtualCourseProgress(userId);
  const existing = progress[entry.course.id];
  progress[entry.course.id] = {
    bestProgressPercent: Math.max(existing?.bestProgressPercent ?? 0, entry.progressPercent),
    courseId: entry.course.id,
    isCompleted: Boolean(existing?.isCompleted || entry.isCompleted),
    lastProgressPercent: entry.progressPercent,
    lastRunAt: entry.completedAt,
  };
  await AsyncStorage.setItem(buildProgressStorageKey(userId), JSON.stringify(progress));
}

export function formatVirtualCourseProgress(progress?: VirtualCourseProgress): string {
  if (!progress) {
    return "Not started";
  }
  if (progress.isCompleted) {
    return "Completed";
  }
  return `Last progress ${Math.round(progress.lastProgressPercent)}%`;
}

function buildHistoryStorageKey(userId: string): string {
  return `${HISTORY_STORAGE_KEY}:${userId}`;
}

function buildProgressStorageKey(userId: string): string {
  return `${PROGRESS_STORAGE_KEY}:${userId}`;
}
