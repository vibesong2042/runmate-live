import { useMemo, useRef } from "react";
import type { Checkpoint, VirtualCourse, VirtualCourseState } from "../types/virtualCourse";

interface UseVirtualCourseInput {
  course: VirtualCourse;
  actualDistanceMeters: number;
}

export function useVirtualCourse({ course, actualDistanceMeters }: UseVirtualCourseInput): VirtualCourseState {
  const lastCheckpointIdRef = useRef<string | undefined>(undefined);

  return useMemo(() => {
    const virtualDistanceMeters = Math.max(0, actualDistanceMeters);
    const completedCheckpoints = course.checkpoints.filter(
      (checkpoint) => checkpoint.distanceMeters <= virtualDistanceMeters,
    );
    const nextCheckpoint = course.checkpoints.find((checkpoint) => checkpoint.distanceMeters > virtualDistanceMeters);
    const currentCheckpoint = getCurrentCheckpoint(completedCheckpoints, lastCheckpointIdRef.current);
    if (currentCheckpoint) {
      lastCheckpointIdRef.current = currentCheckpoint.id;
    }

    return {
      completedCheckpoints,
      course,
      currentCheckpoint,
      isCompleted: virtualDistanceMeters >= course.totalDistanceMeters,
      nextCheckpoint,
      progressPercent: Math.min((virtualDistanceMeters / course.totalDistanceMeters) * 100, 100),
      virtualDistanceMeters,
    };
  }, [actualDistanceMeters, course]);
}

function getCurrentCheckpoint(completedCheckpoints: Checkpoint[], lastCheckpointId?: string): Checkpoint | undefined {
  const newest = completedCheckpoints[completedCheckpoints.length - 1];
  if (!newest || newest.id === lastCheckpointId) {
    return undefined;
  }
  return newest;
}
