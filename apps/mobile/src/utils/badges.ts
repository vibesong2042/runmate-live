import type { ActivityRecord } from "@runmate/shared";
import type { VirtualRunHistoryEntry } from "../types/virtualCourse";

export type RewardBadgeStatus = "earned" | "locked";

export interface RewardBadge {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  status: RewardBadgeStatus;
}

interface BuildRewardBadgesInput {
  activities: ActivityRecord[];
  now?: Date;
  virtualRuns: VirtualRunHistoryEntry[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function buildRewardBadges({ activities, now = new Date(), virtualRuns }: BuildRewardBadgesInput): RewardBadge[] {
  const nowMs = now.getTime();
  const weeklyDistanceMeters = activities
    .filter((activity) => {
      const createdAt = Date.parse(activity.createdAt);
      return Number.isFinite(createdAt) && nowMs - createdAt <= WEEK_MS && createdAt <= nowMs;
    })
    .reduce((total, activity) => total + activity.distanceMeters, 0);
  const completedCheckpointCount = virtualRuns.reduce((total, run) => total + run.completedCheckpoints.length, 0);
  const overtakenGhostCount = virtualRuns.reduce((total, run) => total + run.overtakenGhosts.length, 0);

  return [
    createBadge({
      description: "Finish and save any run.",
      earned: activities.length > 0,
      id: "first-run",
      label: "First Run",
      shortLabel: "RUN",
    }),
    createBadge({
      description: "Save one run of 5 km or more.",
      earned: activities.some((activity) => activity.distanceMeters >= 5000),
      id: "five-k-finisher",
      label: "5K Finisher",
      shortLabel: "5K",
    }),
    createBadge({
      description: "Run 10 km total in the last 7 days.",
      earned: weeklyDistanceMeters >= 10000,
      id: "weekly-10k",
      label: "Weekly 10K",
      shortLabel: "10K",
    }),
    createBadge({
      description: "Complete your first virtual course run.",
      earned: virtualRuns.length > 0,
      id: "virtual-starter",
      label: "Virtual Starter",
      shortLabel: "VR",
    }),
    createBadge({
      description: "Reach 3 virtual checkpoints.",
      earned: completedCheckpointCount >= 3,
      id: "checkpoint-hunter",
      label: "Checkpoint Hunter",
      shortLabel: "CP",
    }),
    createBadge({
      description: "Overtake a ghost runner.",
      earned: overtakenGhostCount > 0,
      id: "ghost-chaser",
      label: "Ghost Chaser",
      shortLabel: "GH",
    }),
  ];
}

function createBadge(input: {
  description: string;
  earned: boolean;
  id: string;
  label: string;
  shortLabel: string;
}): RewardBadge {
  return {
    description: input.description,
    id: input.id,
    label: input.label,
    shortLabel: input.shortLabel,
    status: input.earned ? "earned" : "locked",
  };
}
