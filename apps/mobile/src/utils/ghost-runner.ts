import type { GhostRunner, GhostState, GhostStatus } from "../types/virtualCourse";

export function calculateGhostState(
  ghost: GhostRunner,
  elapsedSeconds: number,
  userVirtualDistanceMeters: number,
): GhostState {
  const ghostDistanceMeters = Math.max(0, (elapsedSeconds / ghost.averagePaceSecPerKm) * 1000);
  const gapMeters = ghostDistanceMeters - userVirtualDistanceMeters;
  return {
    gapMeters,
    ghost,
    ghostDistanceMeters,
    status: getGhostStatus(gapMeters),
  };
}

export function shouldAnnounceGhost(ghostState: GhostState, lastAnnouncedAt?: number): boolean {
  if (Math.abs(ghostState.gapMeters) > 200) {
    return false;
  }
  if (!lastAnnouncedAt) {
    return true;
  }
  return Date.now() - lastAnnouncedAt > 30_000;
}

export function buildGhostAnnouncement(ghostState: GhostState): string {
  const gap = Math.round(Math.abs(ghostState.gapMeters));
  if (ghostState.status === "ahead") {
    return `${ghostState.ghost.displayName} is ${gap} meters ahead. Keep your rhythm and close the gap.`;
  }
  if (ghostState.status === "overtaken") {
    return `You have overtaken ${ghostState.ghost.displayName}. Keep the lead.`;
  }
  return `${ghostState.ghost.displayName} is ${gap} meters behind you. Stay smooth.`;
}

function getGhostStatus(gapMeters: number): GhostStatus {
  if (gapMeters > 10) {
    return "ahead";
  }
  if (gapMeters < -10) {
    return "overtaken";
  }
  return "behind";
}
