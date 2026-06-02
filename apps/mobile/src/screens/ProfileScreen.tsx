import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MetricTile } from "../components/MetricTile";

export function ProfileScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.metricsRow}>
        <MetricTile label="Total Distance" value="184 km" tone="strong" />
        <MetricTile label="Group Runs" value="22" />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Badges</Text>
        <Text style={styles.badge}>First Remote Run</Text>
        <Text style={styles.badge}>Weekly 10K</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 14,
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  panel: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  panelTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  badge: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
  },
});
