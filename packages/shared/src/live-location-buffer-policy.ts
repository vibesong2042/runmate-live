const DEFAULT_MAX_LIVE_LOCATION_BUFFER_POINTS = 500;

export function trimLiveLocationBuffer<T>(
  events: T[],
  maxPoints = DEFAULT_MAX_LIVE_LOCATION_BUFFER_POINTS,
): T[] {
  return events.slice(-Math.max(0, Math.floor(maxPoints)));
}
