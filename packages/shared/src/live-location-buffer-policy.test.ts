import assert from "node:assert/strict";
import { test } from "node:test";
import { trimLiveLocationBuffer } from "./live-location-buffer-policy.js";

test("live location buffer keeps the newest five hundred events", () => {
  const events = Array.from({ length: 503 }, (_, index) => index);
  const trimmed = trimLiveLocationBuffer(events);

  assert.equal(trimmed.length, 500);
  assert.equal(trimmed[0], 3);
  assert.equal(trimmed[499], 502);
});
