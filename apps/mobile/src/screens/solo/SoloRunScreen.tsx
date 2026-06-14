import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { filterDisplayRoutePoints, formatPace, smoothDisplayRoutePoints, type RunningSession } from "@runmate/shared";
import { LiveRunMap } from "../../components/LiveRunMap";
import { MetricTile } from "../../components/MetricTile";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useSoloRun } from "../../hooks/useSoloRun";
import { addDiagnosticBreadcrumb } from "../../monitoring/sentry";
import { savePendingRunResult } from "../../storage/pending-run-results";
import type { SoloRunResult } from "../../types/soloRun";
import { classifyApiError } from "../../utils/error-messages";
import type { RunResultSummary } from "../ResultScreen";

interface SoloRunScreenProps {
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>;
  onCancel: () => void;
  onFinish: (result: RunResultSummary) => void;
  userId: string;
}

export function SoloRunScreen({ authenticatedPost, onCancel, onFinish, userId }: SoloRunScreenProps) {
  const soloRun = useSoloRun();
  const [sessionId, setSessionId] = useState<string>();
  const [setupStatus, setSetupStatus] = useState("Preparing solo run...");
  const [isPreparing, setIsPreparing] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);

  const displayRoute = useMemo(
    () =>
      smoothDisplayRoutePoints(filterDisplayRoutePoints(soloRun.state.acceptedRoute)).map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [soloRun.state.acceptedRoute],
  );

  useEffect(() => {
    addDiagnosticBreadcrumb("solo_run_screen_mounted");
    let isMounted = true;
    async function prepare() {
      try {
        const created = await authenticatedPost<{ session: RunningSession }>("/running-sessions", {
          friendUserIds: [],
          locationSharingRequired: false,
          targetDistanceMeters: 5000,
          title: "Solo Run",
          type: "solo",
          voiceFeedbackEnabled: false,
        });
        await authenticatedPost(`/running-sessions/${created.session.id}/start`, {});
        if (!isMounted) {
          return;
        }
        setSessionId(created.session.id);
        const didStartTracking = await soloRun.start();
        if (!isMounted) {
          return;
        }
        setSetupStatus(didStartTracking ? "Solo run started" : "Location permission is required to track this run.");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const classified = classifyApiError(error, "Could not start solo run.");
        setSetupStatus(classified.message);
      } finally {
        if (isMounted) {
          setIsPreparing(false);
        }
      }
    }
    void prepare();
    return () => {
      isMounted = false;
    };
  }, [authenticatedPost, soloRun.start]);

  function confirmFinish() {
    Alert.alert("Finish solo run?", "This will stop GPS tracking and show your result.", [
      { style: "cancel", text: "Keep Running" },
      { style: "destructive", text: "Finish", onPress: () => void finishSoloRun() },
    ]);
  }

  async function finishSoloRun() {
    if (isFinishing) {
      return;
    }
    setIsFinishing(true);
    const result = soloRun.finish();
    if (!result) {
      setIsFinishing(false);
      return;
    }

    const summary = buildSoloResultSummary(result, userId, sessionId);
    if (!sessionId) {
      onFinish({
        ...summary,
        saveError: "Solo run could not connect to the API before starting.",
        saveStatus: "pending",
      });
      setIsFinishing(false);
      return;
    }

    try {
      await uploadFinalSoloLocation(authenticatedPost, sessionId, result);
      await authenticatedPost(`/running-sessions/${sessionId}/finish`, {});
      onFinish({
        ...summary,
        saveStatus: "saved",
      });
    } catch (error) {
      const classified = classifyApiError(error, "Could not save solo run.");
      const pendingResultId = `${sessionId}-${Date.now()}`;
      const pending: RunResultSummary = {
        ...summary,
        pendingResultId,
        saveError: `${classified.message} This result is kept on this phone.`,
        saveStatus: "pending",
      };
      await savePendingRunResult({
        autoRetryDisabled: false,
        createdAt: new Date().toISOString(),
        id: pendingResultId,
        lastError: pending.saveError,
        result: pending,
        retryCount: 0,
        sessionId,
        userId,
      });
      onFinish(pending);
    } finally {
      setIsFinishing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Solo Run</Text>
          <Text style={styles.title}>{soloRun.state.status === "paused" ? "Paused" : "Run at your pace."}</Text>
        </View>
        <Text style={styles.statusText}>{setupStatus}</Text>
      </View>

      <LiveRunMap
        acceptedPointCount={soloRun.state.acceptedPointCount}
        currentPoint={soloRun.state.currentPoint}
        rejectedPointCount={soloRun.state.rejectedPointCount}
        route={displayRoute}
        statusText={formatGpsStatus(soloRun.state.accuracyMeters)}
        title="Solo Route"
        trackingStatusText={soloRun.state.trackingMessage}
      />

      {soloRun.state.error ? <Text style={styles.errorText}>{soloRun.state.error}</Text> : null}

      <View style={styles.metricsRow}>
        <MetricTile label="Distance" value={`${(soloRun.state.distanceMeters / 1000).toFixed(2)} km`} tone="strong" />
        <MetricTile label="Time" value={formatElapsed(soloRun.state.elapsedSeconds)} />
      </View>
      <View style={styles.metricsRow}>
        <MetricTile label="Current Pace" value={`${formatPace(soloRun.state.currentPaceSecPerKm)}/km`} />
        <MetricTile label="Average Pace" value={`${formatPace(soloRun.state.averagePaceSecPerKm)}/km`} />
      </View>

      <View style={styles.actions}>
        {soloRun.state.status === "running" ? (
          <PrimaryButton label="Pause" variant="secondary" onPress={soloRun.pause} />
        ) : (
          <PrimaryButton
            disabled={soloRun.state.status !== "paused"}
            label="Resume"
            variant="secondary"
            onPress={() => void soloRun.resume()}
          />
        )}
        <PrimaryButton
          disabled={isPreparing || isFinishing || soloRun.state.status === "idle"}
          label={isFinishing ? "Finishing..." : "Finish"}
          variant="danger"
          onPress={confirmFinish}
        />
        <PrimaryButton label="Cancel" variant="secondary" onPress={confirmCancel} />
      </View>
    </ScrollView>
  );

  function confirmCancel() {
    if (soloRun.state.status === "idle" || soloRun.state.status === "finished") {
      onCancel();
      return;
    }
    Alert.alert("Leave solo run?", "This run will not be saved if you leave before finishing.", [
      { style: "cancel", text: "Keep Running" },
      { style: "destructive", text: "Leave", onPress: onCancel },
    ]);
  }
}

function buildSoloResultSummary(result: SoloRunResult, userId: string, sessionId?: string): RunResultSummary {
  return {
    averagePaceSecPerKm: result.averagePaceSecPerKm,
    cheers: 0,
    distanceMeters: result.distanceMeters,
    durationSeconds: result.elapsedSeconds,
    lastPoint: result.lastPoint,
    participants: [
      {
        averagePaceSecPerKm: result.averagePaceSecPerKm,
        currentPaceSecPerKm: result.currentPaceSecPerKm,
        isHost: true,
        movingTimeSeconds: result.elapsedSeconds,
        nickname: "You",
        participantId: "solo-local",
        status: "finished",
        totalDistanceMeters: result.distanceMeters,
        userId,
      },
    ],
    route: result.route,
    saveStatus: "saved",
    sessionId,
  };
}

async function uploadFinalSoloLocation(
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>,
  sessionId: string,
  result: SoloRunResult,
) {
  const point = result.lastPoint;
  if (!point) {
    return;
  }
  await authenticatedPost(`/running-sessions/${sessionId}/locations`, {
    accuracyMeters: point.accuracyMeters,
    altitude: point.altitude,
    averagePaceSecPerKm: result.averagePaceSecPerKm,
    currentPaceSecPerKm: result.currentPaceSecPerKm,
    distanceMeters: result.distanceMeters,
    latitude: point.latitude,
    longitude: point.longitude,
    recordedAt: result.finishedAt,
    state: "finished",
  });
}

function formatGpsStatus(accuracyMeters?: number): string {
  return accuracyMeters === undefined ? "Waiting for GPS signal" : `GPS ${Math.round(accuracyMeters)}m`;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 14,
    padding: 20,
  },
  header: {
    gap: 8,
  },
  kicker: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
  },
  statusText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "800",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actions: {
    gap: 10,
    marginTop: "auto",
  },
});
