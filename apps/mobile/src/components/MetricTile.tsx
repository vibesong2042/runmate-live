import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRunMateTheme } from "../theme/RunMateThemeContext";

interface MetricTileProps {
  label: string;
  value: string;
  tone?: "default" | "strong";
}

export function MetricTile({ label, value, tone = "default" }: MetricTileProps) {
  const theme = useRunMateTheme();
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.secondaryBorder,
        },
        tone === "strong" && {
          backgroundColor: theme.colors.metricStrongBackground,
          borderColor: theme.colors.metricStrongBackground,
        },
      ]}
    >
      <Text style={[styles.value, { color: theme.colors.text }, tone === "strong" && styles.strongValue]}>{value}</Text>
      <Text style={[styles.label, { color: theme.colors.mutedText }, tone === "strong" && { color: theme.colors.metricStrongLabel }]}>
        {label}
      </Text>
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
