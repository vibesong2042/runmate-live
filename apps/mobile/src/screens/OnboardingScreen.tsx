import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { LoginProfile } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";

export function OnboardingScreen({
  error,
  isLoading,
  onDone,
}: {
  error?: string;
  isLoading?: boolean;
  onDone: (profile: LoginProfile) => void;
}) {
  const [nickname, setNickname] = useState("Runner");
  const [runnerId, setRunnerId] = useState("runner");
  const [locationConsent, setLocationConsent] = useState(true);
  const [backgroundConsent, setBackgroundConsent] = useState(false);
  const normalizedRunnerId = runnerId.trim();
  const normalizedNickname = nickname.trim();
  const profileError =
    normalizedRunnerId.length < 3
      ? "Runner ID must be at least 3 characters."
      : /^[a-zA-Z0-9_]+$/.test(normalizedRunnerId)
        ? undefined
        : "Runner ID can use letters, numbers, and underscores only.";
  const canSubmit = !isLoading && !profileError && normalizedNickname.length >= 2 && locationConsent;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>RunMate Live</Text>
      <Text style={styles.subtitle}>Run with friends at the same time, even when everyone starts somewhere else.</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Runner Profile</Text>
        <View style={styles.field}>
          <Text style={styles.inputLabel}>Nickname</Text>
          <TextInput
            autoCapitalize="words"
            editable={!isLoading}
            onChangeText={setNickname}
            placeholder="Runner"
            style={styles.input}
            value={nickname}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.inputLabel}>Runner ID</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            onChangeText={(value) => setRunnerId(value.replace(/[^a-zA-Z0-9_]/g, ""))}
            placeholder="runner"
            style={styles.input}
            value={runnerId}
          />
        </View>
        {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Location Consent</Text>
        <Text style={styles.body}>
          During a run, RunMate uses your location to calculate route, distance, pace, and live session sharing.
        </Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Share live location during runs</Text>
          <Switch value={locationConsent} onValueChange={setLocationConsent} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Allow background run recording</Text>
          <Switch value={backgroundConsent} onValueChange={setBackgroundConsent} />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        disabled={!canSubmit}
        label={isLoading ? "Signing In..." : "Get Started"}
        onPress={() => {
          onDone({ nickname: normalizedNickname, runnerId: normalizedRunnerId });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    padding: 24,
    gap: 20,
    flexGrow: 1,
  },
  title: {
    color: "#0f172a",
    fontSize: 34,
    fontWeight: "900",
  },
  subtitle: {
    color: "#334155",
    fontSize: 17,
    lineHeight: 25,
  },
  panel: {
    gap: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    padding: 18,
  },
  panelTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  body: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
  },
  field: {
    gap: 6,
  },
  inputLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    paddingHorizontal: 12,
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
    fontSize: 14,
    fontWeight: "700",
  },
  error: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
});
