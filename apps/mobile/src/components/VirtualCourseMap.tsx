import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Checkpoint, GhostState, VirtualCourse } from "../types/virtualCourse";

interface VirtualCourseMapProps {
  completedCheckpoints: Checkpoint[];
  course: VirtualCourse;
  ghostStates: GhostState[];
  userDistanceMeters: number;
}

export function VirtualCourseMap({
  completedCheckpoints,
  course,
  ghostStates,
  userDistanceMeters,
}: VirtualCourseMapProps) {
  const progressPercent = Math.min((userDistanceMeters / course.totalDistanceMeters) * 100, 100);
  const completedIds = new Set(completedCheckpoints.map((checkpoint) => checkpoint.id));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Virtual Course</Text>
          <Text style={styles.subtitle}>
            {(userDistanceMeters / 1000).toFixed(2)} / {(course.totalDistanceMeters / 1000).toFixed(1)} km
          </Text>
        </View>
        <Text style={[styles.percent, { color: course.accentColor }]}>{Math.round(progressPercent)}%</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.progress, { backgroundColor: course.accentColor, width: `${progressPercent}%` }]} />
        {course.checkpoints.map((checkpoint) => {
          const left = `${Math.min((checkpoint.distanceMeters / course.totalDistanceMeters) * 100, 100)}%` as const;
          return (
            <View key={checkpoint.id} style={[styles.checkpointMarker, { left }]}>
              <View style={[styles.dot, completedIds.has(checkpoint.id) && { backgroundColor: course.accentColor }]} />
            </View>
          );
        })}
      </View>

      <View style={styles.checkpointList}>
        {course.checkpoints.map((checkpoint) => (
          <Text key={checkpoint.id} style={[styles.checkpointText, completedIds.has(checkpoint.id) && styles.completedText]}>
            {completedIds.has(checkpoint.id) ? "Done" : "Next"} - {(checkpoint.distanceMeters / 1000).toFixed(1)} km -{" "}
            {checkpoint.landmarkName}
          </Text>
        ))}
      </View>

      {ghostStates.length ? (
        <View style={styles.ghostRow}>
          {ghostStates.slice(0, 3).map((ghostState) => (
            <Text key={ghostState.ghost.id} style={styles.ghostText}>
              {ghostState.ghost.displayName}: {Math.round(Math.abs(ghostState.gapMeters))} m{" "}
              {ghostState.status === "ahead" ? "ahead" : ghostState.status === "overtaken" ? "behind" : "near"}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
  },
  percent: {
    fontSize: 22,
    fontWeight: "900",
  },
  track: {
    height: 14,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progress: {
    height: "100%",
  },
  checkpointMarker: {
    position: "absolute",
    top: -3,
    marginLeft: -5,
  },
  dot: {
    width: 10,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#94a3b8",
  },
  checkpointList: {
    gap: 5,
  },
  checkpointText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  completedText: {
    color: "#0f766e",
  },
  ghostRow: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  ghostText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
});
