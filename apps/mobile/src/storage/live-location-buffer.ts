import AsyncStorage from "@react-native-async-storage/async-storage";
import { trimLiveLocationBuffer, type ClientRealtimeEvent } from "@runmate/shared";

const STORAGE_PREFIX = "runmate.liveLocationBuffer.v1";
const MAX_BUFFERED_POINTS = 500;

export function getLiveLocationBufferKey(sessionId: string, userId: string): string {
  return `${STORAGE_PREFIX}:${sessionId}:${userId}`;
}

export async function loadLiveLocationBuffer(sessionId: string, userId: string): Promise<ClientRealtimeEvent[]> {
  const key = getLiveLocationBufferKey(sessionId, userId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const events = JSON.parse(raw) as ClientRealtimeEvent[];
    return trimLiveLocationBuffer(
      events.filter((event) => event.type === "location:update"),
      MAX_BUFFERED_POINTS,
    );
  } catch {
    await AsyncStorage.removeItem(key);
    return [];
  }
}

export async function saveLiveLocationBuffer(
  sessionId: string,
  userId: string,
  events: ClientRealtimeEvent[],
): Promise<ClientRealtimeEvent[]> {
  const key = getLiveLocationBufferKey(sessionId, userId);
  const nextEvents = trimLiveLocationBuffer(
    events.filter((event) => event.type === "location:update"),
    MAX_BUFFERED_POINTS,
  );
  await AsyncStorage.setItem(key, JSON.stringify(nextEvents));
  return nextEvents;
}

export async function enqueueLiveLocationEvent(
  sessionId: string,
  userId: string,
  event: ClientRealtimeEvent,
): Promise<ClientRealtimeEvent[]> {
  const current = await loadLiveLocationBuffer(sessionId, userId);
  return saveLiveLocationBuffer(sessionId, userId, [...current, event]);
}

export async function clearLiveLocationBuffer(sessionId: string, userId: string): Promise<void> {
  await AsyncStorage.removeItem(getLiveLocationBufferKey(sessionId, userId));
}
