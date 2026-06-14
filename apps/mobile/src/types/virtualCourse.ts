export interface Checkpoint {
  id: string;
  distanceMeters: number;
  landmarkName: string;
  description: string;
  coachingNote: string;
}

export interface GhostRunner {
  id: string;
  displayName: string;
  originCity: string;
  averagePaceSecPerKm: number;
}

export interface VirtualCourse {
  id: string;
  name: string;
  city: string;
  country: string;
  totalDistanceMeters: number;
  description: string;
  accentColor: string;
  checkpoints: Checkpoint[];
  ghosts: GhostRunner[];
}

export interface VirtualCourseState {
  course: VirtualCourse;
  virtualDistanceMeters: number;
  progressPercent: number;
  currentCheckpoint?: Checkpoint;
  nextCheckpoint?: Checkpoint;
  completedCheckpoints: Checkpoint[];
  isCompleted: boolean;
}

export type GhostStatus = "ahead" | "behind" | "overtaken";

export interface GhostState {
  ghost: GhostRunner;
  ghostDistanceMeters: number;
  gapMeters: number;
  status: GhostStatus;
}

export interface VirtualRunResultSummary {
  course: VirtualCourse;
  distanceMeters: number;
  elapsedSeconds: number;
  averagePaceSecPerKm?: number;
  completedCheckpoints: Checkpoint[];
  overtakenGhosts: GhostRunner[];
  isCompleted: boolean;
  progressPercent: number;
}
