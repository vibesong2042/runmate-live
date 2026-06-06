import assert from "node:assert/strict";
import { test } from "node:test";
import { assessLocationForRunning, calculateTotalDistanceMeters, type GeoPoint } from "./running-metrics.js";

function point(latitude: number, longitude: number, seconds: number, accuracyMeters = 8): GeoPoint {
  return {
    latitude,
    longitude,
    accuracyMeters,
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)).toISOString(),
  };
}

test("running speed samples are accepted", () => {
  const previous = point(37.5665, 126.978, 0);
  const next = point(37.56695, 126.978, 10);

  const assessment = assessLocationForRunning(previous, next);

  assert.equal(assessment.accepted, true);
  assert.equal(assessment.reason, undefined);
  assert.ok((assessment.distanceMeters ?? 0) > 40);
});

test("low accuracy samples are rejected", () => {
  const previous = point(37.5665, 126.978, 0);
  const next = point(37.56695, 126.978, 10, 80);

  const assessment = assessLocationForRunning(previous, next);

  assert.equal(assessment.accepted, false);
  assert.equal(assessment.reason, "low_accuracy");
});

test("vehicle speed samples are rejected as too fast", () => {
  const previous = point(37.5665, 126.978, 0);
  const next = point(37.5683, 126.978, 10);

  const assessment = assessLocationForRunning(previous, next);

  assert.equal(assessment.accepted, false);
  assert.equal(assessment.reason, "too_fast");
  assert.ok((assessment.speedMps ?? 0) > 12);
});

test("tiny GPS drift is rejected", () => {
  const previous = point(37.5665, 126.978, 0);
  const next = point(37.56651, 126.978, 5);

  const assessment = assessLocationForRunning(previous, next);

  assert.equal(assessment.accepted, false);
  assert.equal(assessment.reason, "too_short");
});

test("stale large gaps reset the anchor instead of counting distance", () => {
  const previous = point(37.5665, 126.978, 0);
  const next = point(37.5692, 126.978, 59);

  const assessment = assessLocationForRunning(previous, next);

  assert.equal(assessment.accepted, false);
  assert.equal(assessment.reason, "stale_or_invalid_time");
  assert.equal(assessment.shouldResetAnchor, true);
});

test("one GPS spike does not prevent later normal distance recovery", () => {
  const start = point(37.5665, 126.978, 0);
  const spike = point(37.5683, 126.978, 10);
  const recovered = point(37.567, 126.978, 20);

  const spikeAssessment = assessLocationForRunning(start, spike);
  const recoveredAssessment = assessLocationForRunning(start, recovered);

  assert.equal(spikeAssessment.accepted, false);
  assert.equal(spikeAssessment.reason, "too_fast");
  assert.equal(recoveredAssessment.accepted, true);
});

test("total distance recovers from a single rejected GPS spike", () => {
  const points = [
    point(37.5665, 126.978, 0),
    point(37.5683, 126.978, 10),
    point(37.567, 126.978, 20),
  ];

  const distance = calculateTotalDistanceMeters(points);

  assert.ok(distance >= 45);
  assert.ok(distance < 70);
});

test("total distance resumes after a stale jump resets the anchor", () => {
  const points = [
    point(37.5665, 126.978, 0),
    point(37.5692, 126.978, 59),
    point(37.56965, 126.978, 69),
  ];

  const distance = calculateTotalDistanceMeters(points);

  assert.ok(distance >= 45);
  assert.ok(distance < 70);
});

test("total distance excludes tiny drift and vehicle jumps", () => {
  const points = [
    point(37.5665, 126.978, 0),
    point(37.56651, 126.978, 5),
    point(37.56695, 126.978, 15),
    point(37.57, 126.978, 25),
  ];

  const distance = calculateTotalDistanceMeters(points);

  assert.ok(distance >= 45);
  assert.ok(distance < 80);
});
