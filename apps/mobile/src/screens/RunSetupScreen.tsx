import React, { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import type { RunningSession, RunningSessionParticipant } from "@runmate/shared";
import { PrimaryButton } from "../components/PrimaryButton";

interface RunSetupScreenProps {
  accessToken?: string;
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>;
  onStart: (sessionId: string) => void;
  onCancel: () => void;
}

export function RunSetupScreen({ accessToken, authenticatedPost, onStart, onCancel }: RunSetupScreenProps) {
  const [shareLocation, setShareLocation] = useState(true);
  const [voice, setVoice] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string>();

  async function createAndStartSession() {
    setIsStarting(true);
    setError(undefined);
    try {
      if (!accessToken) {
        throw new Error("Missing access token");
      }

      const created = await authenticatedPost<{
        session: RunningSession;
        participants: RunningSessionParticipant[];
      }>("/running-sessions", {
        title: "Remote 5K",
        type: "group",
        targetDistanceMeters: 5000,
        friendUserIds: [],
        locationSharingRequired: shareLocation,
        voiceFeedbackEnabled: voice,
      });
      await authenticatedPost(`/running-sessions/${created.session.id}/start`, {});
      onStart(created.session.id);
    } catch {
      setError("Could not start the running session.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Run Setup</Text>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Remote 5K</Text>
        <Text style={styles.body}>Goal 5.0 km - invited friends only - individual start supported</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Share location during session</Text>
          <Switch value={shareLocation} onValueChange={setShareLocation} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Voice feedback</Text>
          <Switch value={voice} onValueChange={setVoice} />
        </View>
      </View>

      <View style={styles.participants}>
        <Text style={styles.sectionTitle}>Participants</Text>
        <Text style={styles.ready}>You - ready</Text>
        <Text style={styles.ready}>Minsu - ready</Text>
        <Text style={styles.waiting}>Jihyun - waiting</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton label={isStarting ? "Starting..." : "Start"} onPress={createAndStartSession} />
        <PrimaryButton label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 18,
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
  },
  panel: {
    gap: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  panelTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
  },
  body: {
    color: "#475569",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  participants: {
    gap: 8,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  ready: {
    color: "#0f766e",
    fontSize: 15,
    fontWeight: "700",
  },
  waiting: {
    color: "#f97316",
    fontSize: 15,
    fontWeight: "700",
  },
  error: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
  actions: {
    marginTop: "auto",
    gap: 10,
  },
});
