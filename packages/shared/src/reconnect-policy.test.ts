import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateReconnectDelayMs, hasExceededReconnectAttempts } from "./reconnect-policy.js";

test("reconnect delay uses exponential backoff capped at thirty seconds", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((attempt) => calculateReconnectDelayMs(attempt)),
    [1000, 2000, 4000, 8000, 16000, 30000, 30000],
  );
});

test("reconnect attempts stop after the configured maximum", () => {
  assert.equal(hasExceededReconnectAttempts(10), false);
  assert.equal(hasExceededReconnectAttempts(11), true);
  assert.equal(hasExceededReconnectAttempts(4, { maxAttempts: 3 }), true);
});
