import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";

interface SoloModeSelectScreenProps {
  onBack: () => void;
  onSelectStandard: () => void;
  onSelectVirtual: () => void;
}

export function SoloModeSelectScreen({ onBack, onSelectStandard, onSelectVirtual }: SoloModeSelectScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View>
        <Text style={styles.kicker}>Solo Run</Text>
        <Text style={styles.title}>Choose your solo experience.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Standard Solo Run</Text>
        <Text style={styles.cardBody}>Track your real route, distance, pace, and finish result.</Text>
        <PrimaryButton label="Start Standard Run" onPress={onSelectStandard} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Virtual Global Course</Text>
        <Text style={styles.cardBody}>
          Run your local route while your distance moves through a global course with checkpoints and ghost runners.
        </Text>
        <PrimaryButton label="Choose Course" onPress={onSelectVirtual} />
      </View>

      <PrimaryButton label="Back" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 20,
  },
  kicker: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
  },
  title: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  card: {
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  cardBody: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
});
