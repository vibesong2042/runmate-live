import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";

export function SettingsScreen() {
  const [defaultShare, setDefaultShare] = useState(true);
  const [voice, setVoice] = useState(true);
  const [safety, setSafety] = useState(true);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.panel}>
        <SettingRow label="Default live location sharing" value={defaultShare} onValueChange={setDefaultShare} />
        <SettingRow label="Voice feedback" value={voice} onValueChange={setVoice} />
        <SettingRow label="Safety contact alerts" value={safety} onValueChange={setSafety} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Privacy</Text>
        <Text style={styles.body}>
          Detailed routes are private by default. Live location is visible only to invited session participants.
        </Text>
      </View>
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
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
  panel: {
    gap: 12,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  body: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
  },
});
