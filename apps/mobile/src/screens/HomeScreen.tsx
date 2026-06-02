import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";
import type { AppScreen } from "../state/app-state";

export function HomeScreen({ onNavigate }: { onNavigate: (screen: AppScreen) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View>
        <Text style={styles.kicker}>Today</Text>
        <Text style={styles.title}>Start a remote 5K with your friends.</Text>
      </View>

      <View style={styles.metricsRow}>
        <MetricTile label="This Week" value="12.4 km" tone="strong" />
        <MetricTile label="Group Runs" value="3" />
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Run With Friends" onPress={() => onNavigate("runSetup")} />
        <PrimaryButton label="Invite Friends" variant="secondary" onPress={() => onNavigate("friends")} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Friends</Text>
        <View style={styles.friendRun}>
          <Text style={styles.friendName}>Minsu</Text>
          <Text style={styles.friendMeta}>3.2 km - 5:48/km - running now</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
  },
  kicker: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
  },
  title: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actions: {
    gap: 10,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  friendRun: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  friendName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  friendMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
  },
});
