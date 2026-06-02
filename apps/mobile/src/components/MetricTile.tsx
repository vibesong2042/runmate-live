import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface MetricTileProps {
  label: string;
  value: string;
  tone?: "default" | "strong";
}

export function MetricTile({ label, value, tone = "default" }: MetricTileProps) {
  return (
    <View style={[styles.tile, tone === "strong" && styles.strongTile]}>
      <Text style={[styles.value, tone === "strong" && styles.strongValue]}>{value}</Text>
      <Text style={[styles.label, tone === "strong" && styles.strongLabel]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 76,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  strongTile: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  value: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800",
  },
  strongValue: {
    color: "#ffffff",
  },
  label: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  strongLabel: {
    color: "#ccfbf1",
  },
});
