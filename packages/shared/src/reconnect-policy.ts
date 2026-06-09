const DEFAULT_INITIAL_RECONNECT_DELAY_MS = 1000;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

export interface ReconnectPolicy {
  initialDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}

export function calculateReconnectDelayMs(attempt: number, policy: ReconnectPolicy = {}): number {
  const initialDelayMs = policy.initialDelayMs ?? DEFAULT_INITIAL_RECONNECT_DELAY_MS;
  const maxDelayMs = policy.maxDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
  const safeAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(maxDelayMs, initialDelayMs * 2 ** (safeAttempt - 1));
}

export function hasExceededReconnectAttempts(attempt: number, policy: ReconnectPolicy = {}): boolean {
  return attempt > (policy.maxAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS);
}
