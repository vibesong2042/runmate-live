import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { formatPace } from "@runmate/shared";
import type { SessionParticipantSummaryDto } from "../api/client";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";

export interface RunResultSummary {
  sessionId?: string;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSecPerKm?: number;
  cheers: number;
  participants: SessionParticipantSummaryDto[];
  saveStatus?: "saved" | "pending" | "retrying" | "failed";
  pendingResultId?: string;
  saveError?: string;
}

export function ResultScreen({
  isRetryingSave = false,
  onDone,
  onRetrySave,
  result,
}: {
  isRetryingSave?: boolean;
  onDone: () => void;
  onRetrySave?: (result: RunResultSummary) => void;
  result?: RunResultSummary;
}) {
  const distanceMeters = result?.distanceMeters ?? 0;
  const durationSeconds = result?.durationSeconds ?? 0;
  const averagePaceSecPerKm = result?.averagePaceSecPerKm;
  const cheers = result?.cheers ?? 0;
  const participants = result?.participants ?? [];
  const canRetrySave =
    Boolean(result?.sessionId) && Boolean(result?.pendingResultId) && result?.saveStatus !== "saved" && !isRetryingSave;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Run Complete</Text>
      <View style={[styles.savePanel, result?.saveStatus === "saved" ? styles.savedPanel : styles.pendingPanel]}>
        <Text style={styles.saveTitle}>{getSaveStatusTitle(result?.saveStatus, isRetryingSave)}</Text>
        <Text style={styles.saveBody}>{getSaveStatusBody(result, isRetryingSave)}</Text>
        {canRetrySave && onRetrySave ? (
          <PrimaryButton label="Retry Save" variant="secondary" onPress={() => onRetrySave(result!)} />
        ) : null}
      </View>

      <View style={styles.metricsRow}>
        <MetricTile label="Distance" value={`${(distanceMeters / 1000).toFixed(2)} km`} tone="strong" />
        <MetricTile label="Average Pace" value={`${formatPace(averagePaceSecPerKm)}/km`} />
      </View>
      <View style={styles.metricsRow}>
        <MetricTile label="Time" value={formatElapsed(durationSeconds)} />
        <MetricTile label="Cheers" value={`${cheers}`} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Friend Comparison</Text>
        {participants.length ? (
          participants.map((participant) => (
            <Text key={participant.participantId} style={styles.line}>
              {participant.nickname} - {(participant.totalDistanceMeters / 1000).toFixed(2)} km -{" "}
              {formatPace(participant.averagePaceSecPerKm)}/km
            </Text>
          ))
        ) : (
          <Text style={styles.line}>No friend comparison yet.</Text>
        )}
      </View>

      <PrimaryButton label="Back Home" onPress={onDone} />
    </ScrollView>
  );
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getSaveStatusTitle(status: RunResultSummary["saveStatus"], isRetrying: boolean): string {
  if (isRetrying) {
    return "Saving result...";
  }
  if (status === "saved") {
    return "Result saved";
  }
  if (status === "failed") {
    return "Result still on this phone";
  }
  if (status === "pending") {
    return "Result waiting to save";
  }
  return "Result saved locally";
}

function getSaveStatusBody(result: RunResultSummary | undefined, isRetrying: boolean): string {
  if (isRetrying) {
    return "RunMate is trying the API again.";
  }
  if (result?.saveStatus === "saved") {
    return "Your activity was saved to the API and can appear in your history.";
  }
  if (result?.saveStatus === "failed") {
    return result.saveError ?? "The API is still unavailable. Try again when the connection is back.";
  }
  if (result?.saveStatus === "pending") {
    return "The API was unavailable at finish. This result is kept on this phone so you can retry. It is lost if the app is reinstalled.";
  }
  return "If the API was offline, this result may only be visible on this screen.";
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
  savePanel: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  savedPanel: {
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
  },
  pendingPanel: {
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
  },
  saveTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  saveBody: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
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
