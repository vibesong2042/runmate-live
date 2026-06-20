import React, { useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { formatPace } from "@runmate/shared";
import { MetricTile } from "../../components/MetricTile";
import { PrimaryButton } from "../../components/PrimaryButton";
import type { VirtualRunResultSummary } from "../../types/virtualCourse";
import type { RunResultSummary } from "../ResultScreen";

interface VirtualRunResultScreenProps {
  isRetryingSave?: boolean;
  onDone: () => void;
  onRetrySave?: (result: RunResultSummary) => void;
  result?: RunResultSummary;
  virtualResult?: VirtualRunResultSummary;
}

export function VirtualRunResultScreen({
  isRetryingSave = false,
  onDone,
  onRetrySave,
  result,
  virtualResult,
}: VirtualRunResultScreenProps) {
  const canRetrySave =
    Boolean(result?.sessionId) && Boolean(result?.pendingResultId) && result?.saveStatus !== "saved" && !isRetryingSave;
  const [shareStatus, setShareStatus] = useState<string>();

  async function handleShare() {
    if (!virtualResult) {
      return;
    }
    try {
      await shareVirtualResult(virtualResult);
      setShareStatus("Share sheet opened.");
    } catch {
      setShareStatus("Could not open sharing. Your result is still saved on this phone.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Virtual Run Complete</Text>
      <View style={[styles.savePanel, result?.saveStatus === "saved" ? styles.savedPanel : styles.pendingPanel]}>
        <Text style={styles.saveTitle}>{getSaveStatusTitle(result?.saveStatus, isRetryingSave)}</Text>
        <Text style={styles.saveBody}>{getSaveStatusBody(result, isRetryingSave)}</Text>
        {canRetrySave && onRetrySave && result ? (
          <PrimaryButton label="Retry Save" variant="secondary" onPress={() => onRetrySave(result)} />
        ) : null}
      </View>

      {virtualResult ? (
        <>
          <View style={[styles.coursePanel, { borderColor: virtualResult.course.accentColor }]}>
            <Text style={styles.courseName}>{virtualResult.course.name}</Text>
            <Text style={styles.courseMeta}>
              {virtualResult.course.city}, {virtualResult.course.country} - {Math.round(virtualResult.progressPercent)}%
            </Text>
            <Text style={styles.courseBody}>
              {virtualResult.isCompleted
                ? "Course completed."
                : `${(virtualResult.distanceMeters / 1000).toFixed(2)} km completed on this virtual route.`}
            </Text>
          </View>

          <View style={styles.metricsRow}>
            <MetricTile label="Distance" value={`${(virtualResult.distanceMeters / 1000).toFixed(2)} km`} tone="strong" />
            <MetricTile label="Average Pace" value={`${formatPace(virtualResult.averagePaceSecPerKm)}/km`} />
          </View>
          <View style={styles.metricsRow}>
            <MetricTile label="Time" value={formatElapsed(virtualResult.elapsedSeconds)} />
            <MetricTile label="Ghosts Passed" value={`${virtualResult.overtakenGhosts.length}`} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Checkpoints</Text>
            {virtualResult.completedCheckpoints.length ? (
              virtualResult.completedCheckpoints.map((checkpoint) => (
                <Text key={checkpoint.id} style={styles.line}>
                  {(checkpoint.distanceMeters / 1000).toFixed(1)} km - {checkpoint.landmarkName}
                </Text>
              ))
            ) : (
              <Text style={styles.line}>No checkpoints reached yet.</Text>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Ghost Runners</Text>
            {virtualResult.overtakenGhosts.length ? (
              virtualResult.overtakenGhosts.map((ghost) => (
                <Text key={ghost.id} style={styles.line}>
                  Passed {ghost.displayName} from {ghost.originCity}
                </Text>
              ))
            ) : (
              <Text style={styles.line}>No ghost runners passed yet.</Text>
            )}
          </View>
        </>
      ) : (
        <Text style={styles.line}>Virtual result unavailable.</Text>
      )}

      {virtualResult ? (
        <>
          <PrimaryButton label="Share Result" variant="secondary" onPress={() => void handleShare()} />
          {shareStatus ? <Text style={styles.shareStatus}>{shareStatus}</Text> : null}
        </>
      ) : null}
      <PrimaryButton label="Back Home" onPress={onDone} />
    </ScrollView>
  );
}

async function shareVirtualResult(result: VirtualRunResultSummary): Promise<void> {
  const checkpoints = result.completedCheckpoints.length
    ? result.completedCheckpoints.map((checkpoint) => checkpoint.landmarkName).join(", ")
    : "none";
  await Share.share({
    message: [
      "RunMate Live Virtual Run",
      `${result.course.name} (${result.course.city})`,
      `Distance: ${(result.distanceMeters / 1000).toFixed(2)} km`,
      `Progress: ${Math.round(result.progressPercent)}%`,
      `Average pace: ${formatPace(result.averagePaceSecPerKm)}/km`,
      `Checkpoints: ${checkpoints}`,
      `Ghost runners passed: ${result.overtakenGhosts.length}`,
    ].join("\n"),
  });
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
    return "Your activity was saved to the API.";
  }
  if (result?.saveStatus === "failed") {
    return result.saveError ?? "The API is still unavailable. Try again when the connection is back.";
  }
  if (result?.saveStatus === "pending") {
    return "The API was unavailable at finish. This result is kept on this phone so you can retry.";
  }
  return "If the API was offline, this result may only be visible on this screen.";
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 20,
  },
  title: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "900",
  },
  coursePanel: {
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    padding: 16,
  },
  courseName: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
  },
  courseMeta: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
  },
  courseBody: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
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
  shareStatus: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
});
