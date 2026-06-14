import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GhostState } from "../types/virtualCourse";

interface GhostRunnerBadgeProps {
  ghostState: GhostState;
}

export function GhostRunnerBadge({ ghostState }: GhostRunnerBadgeProps) {
  const gapMeters = Math.round(Math.abs(ghostState.gapMeters));
  const statusText =
    ghostState.status === "ahead"
      ? `${gapMeters} m ahead`
      : ghostState.status === "overtaken"
        ? `${gapMeters} m behind`
        : "side by side";

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.name}>{ghostState.ghost.displayName}</Text>
        <Text style={styles.origin}>{ghostState.ghost.originCity}</Text>
      </View>
      <Text style={[styles.status, ghostState.status === "overtaken" && styles.overtaken]}>{statusText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  name: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  origin: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  status: {
    color: "#b45309",
    fontSize: 13,
    fontWeight: "900",
  },
  overtaken: {
    color: "#0f766e",
  },
});
