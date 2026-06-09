import assert from "node:assert/strict";
import { test } from "node:test";
import { filterDisplayRoutePoints, smoothDisplayRoutePoints } from "./route-display.js";
import type { GeoPoint } from "./running-metrics.js";

function point(latitude: number, longitude: number, seconds: number, accuracyMeters = 8): GeoPoint {
  return {
    latitude,
    longitude,
    accuracyMeters,
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)).toISOString(),
  };
}

test("display route excludes points above twenty meter accuracy by default", () => {
  const route = filterDisplayRoutePoints([
    point(37.5665, 126.978, 0, 8),
    point(37.5668, 126.978, 10, 24),
    point(37.56695, 126.978, 20, 8),
  ]);

  assert.equal(route.length, 2);
  assert.equal(route[1].latitude, 37.56695);
});

test("display route excludes vehicle speed jumps", () => {
  const route = filterDisplayRoutePoints([
    point(37.5665, 126.978, 0, 8),
    point(37.5683, 126.978, 10, 8),
    point(37.56695, 126.978, 20, 8),
  ]);

  assert.equal(route.length, 2);
  assert.equal(route[1].latitude, 37.56695);
});

test("display route smoothing changes only coordinates for display", () => {
  const route = [
    point(37.5665, 126.978, 0),
    point(37.5668, 126.9783, 10),
    point(37.5671, 126.9786, 20),
  ];

  const smoothed = smoothDisplayRoutePoints(route);

  assert.equal(smoothed.length, route.length);
  assert.notEqual(smoothed[2].latitude, route[2].latitude);
  assert.equal(smoothed[2].recordedAt, route[2].recordedAt);
  assert.equal(route[2].latitude, 37.5671);
});
