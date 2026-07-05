import assert from "node:assert/strict";
import { test } from "node:test";
import type { ActivityRecord } from "@runmate/shared";
import { buildRewardBadges } from "./badges";
import type { VirtualRunHistoryEntry } from "../types/virtualCourse";

const now = new Date("2026-07-05T12:00:00.000Z");

test("locks every reward badge when the runner has no activities or virtual runs", () => {
  const badges = buildRewardBadges({ activities: [], now, virtualRuns: [] });

  assert.equal(badges.length, 6);
  assert.equal(badges.every((badge) => badge.status === "locked"), true);
});

test("earns run distance badges from saved activity records", () => {
  const badges = buildRewardBadges({
    activities: [
      buildActivity({ createdAt: "2026-07-05T09:00:00.000Z", distanceMeters: 5000 }),
      buildActivity({ createdAt: "2026-07-03T09:00:00.000Z", distanceMeters: 5200 }),
    ],
    now,
    virtualRuns: [],
  });

  assert.equal(findBadge(badges, "first-run").status, "earned");
  assert.equal(findBadge(badges, "five-k-finisher").status, "earned");
  assert.equal(findBadge(badges, "weekly-10k").status, "earned");
});

test("keeps weekly 10K locked when activity distance is outside the seven day window", () => {
  const badges = buildRewardBadges({
    activities: [
      buildActivity({ createdAt: "2026-06-20T09:00:00.000Z", distanceMeters: 10000 }),
      buildActivity({ createdAt: "2026-07-05T09:00:00.000Z", distanceMeters: 1000 }),
    ],
    now,
    virtualRuns: [],
  });

  assert.equal(findBadge(badges, "weekly-10k").status, "locked");
});

test("earns virtual course badges from local virtual history", () => {
  const badges = buildRewardBadges({
    activities: [],
    now,
    virtualRuns: [
      buildVirtualRun({
        completedCheckpoints: 3,
        overtakenGhosts: 1,
      }),
    ],
  });

  assert.equal(findBadge(badges, "virtual-starter").status, "earned");
  assert.equal(findBadge(badges, "checkpoint-hunter").status, "earned");
  assert.equal(findBadge(badges, "ghost-chaser").status, "earned");
});

function findBadge(badges: ReturnType<typeof buildRewardBadges>, id: string) {
  const badge = badges.find((item) => item.id === id);
  assert.ok(badge, `Expected badge ${id}`);
  return badge;
}

function buildActivity(input: { createdAt: string; distanceMeters: number }): ActivityRecord {
  return {
    averagePaceSecPerKm: 360,
    createdAt: input.createdAt,
    distanceMeters: input.distanceMeters,
    durationSeconds: 1800,
    id: `activity-${input.createdAt}`,
    movingTimeSeconds: 1800,
    routePolyline: "",
    userId: "user-1",
    visibility: "friends",
  };
}

function buildVirtualRun(input: { completedCheckpoints: number; overtakenGhosts: number }): VirtualRunHistoryEntry {
  return {
    averagePaceSecPerKm: 360,
    completedAt: "2026-07-05T09:30:00.000Z",
    completedCheckpoints: Array.from({ length: input.completedCheckpoints }, (_, index) => ({
      coachingNote: "Keep going.",
      description: "Checkpoint",
      distanceMeters: (index + 1) * 1000,
      id: `checkpoint-${index}`,
      landmarkName: `Checkpoint ${index + 1}`,
    })),
    course: {
      accentColor: "#0f766e",
      checkpoints: [],
      city: "Seoul",
      country: "KR",
      description: "Test course",
      ghosts: [],
      id: "test-course",
      name: "Test Course",
      totalDistanceMeters: 10000,
    },
    distanceMeters: 3000,
    elapsedSeconds: 1200,
    id: "virtual-1",
    isCompleted: false,
    overtakenGhosts: Array.from({ length: input.overtakenGhosts }, (_, index) => ({
      averagePaceSecPerKm: 420,
      displayName: `Ghost ${index + 1}`,
      id: `ghost-${index}`,
      originCity: "Seoul",
    })),
    progressPercent: 30,
  };
}
