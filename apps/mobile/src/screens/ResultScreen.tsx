import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";

export function ResultScreen({ onDone }: { onDone: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Run Complete</Text>
      <View style={styles.metricsRow}>
        <MetricTile label="Distance" value="5.00 km" tone="strong" />
        <MetricTile label="Average Pace" value="5:56/km" />
      </View>
      <View style={styles.metricsRow}>
        <MetricTile label="Time" value="29:40" />
        <MetricTile label="Cheers" value="8" />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Friend Comparison</Text>
        <Text style={styles.line}>You - 5.00 km - 29:40</Text>
        <Text style={styles.line}>Minsu - 5.00 km - 30:12</Text>
        <Text style={styles.line}>Jihyun - 4.62 km - finished</Text>
      </View>

      <PrimaryButton label="Back Home" onPress={onDone} />
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
    fontSize: 30,
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
  line: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
});
