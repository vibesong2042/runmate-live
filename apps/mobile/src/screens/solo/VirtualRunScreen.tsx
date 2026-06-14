import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { filterDisplayRoutePoints, formatPace, smoothDisplayRoutePoints, type RunningSession } from "@runmate/shared";
import { GhostRunnerBadge } from "../../components/GhostRunnerBadge";
import { LiveRunMap } from "../../components/LiveRunMap";
import { MetricTile } from "../../components/MetricTile";
import { PrimaryButton } from "../../components/PrimaryButton";
import { VirtualCourseMap } from "../../components/VirtualCourseMap";
import { getCourseById } from "../../data/courses";
import { useSoloRun } from "../../hooks/useSoloRun";
import { useVirtualCourse } from "../../hooks/useVirtualCourse";
import { addDiagnosticBreadcrumb } from "../../monitoring/sentry";
import { savePendingRunResult } from "../../storage/pending-run-results";
import type { SoloRunResult } from "../../types/soloRun";
import type { GhostRunner, GhostState, VirtualRunResultSummary } from "../../types/virtualCourse";
import { buildGhostAnnouncement, calculateGhostState, shouldAnnounceGhost } from "../../utils/ghost-runner";
import { classifyApiError } from "../../utils/error-messages";
import type { RunResultSummary } from "../ResultScreen";

const SAFETY_ACK_KEY = "runmate.virtualRunSafetyAcknowledged.v1";

interface VirtualRunScreenProps {
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>;
  courseId: string;
  onCancel: () => void;
  onFinish: (result: RunResultSummary, virtualResult: VirtualRunResultSummary) => void;
  userId: string;
}

export function VirtualRunScreen({ authenticatedPost, courseId, onCancel, onFinish, userId }: VirtualRunScreenProps) {
  const selectedCourse = getCourseById(courseId);
  const course = selectedCourse ?? fallbackCourse();
  const soloRun = useSoloRun();
  const [sessionId, setSessionId] = useState<string>();
  const [setupStatus, setSetupStatus] = useState("Preparing virtual run...");
  const [isPreparing, setIsPreparing] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [audioStatus, setAudioStatus] = useState("Checkpoint guide ready");
  const lastGhostAnnouncementsRef = useRef<Record<string, number>>({});
  const announcedCheckpointIdsRef = useRef(new Set<string>());
  const virtualCourse = useVirtualCourse({
    actualDistanceMeters: soloRun.state.distanceMeters,
    course: course ?? fallbackCourse(),
  });

  const ghostStates = useMemo<GhostState[]>(
    () =>
      virtualCourse.course.ghosts
        .map((ghost) => calculateGhostState(ghost, soloRun.state.elapsedSeconds, virtualCourse.virtualDistanceMeters))
        .sort((a, b) => Math.abs(a.gapMeters) - Math.abs(b.gapMeters)),
    [soloRun.state.elapsedSeconds, virtualCourse.course.ghosts, virtualCourse.virtualDistanceMeters],
  );

  const displayRoute = useMemo(
    () =>
      smoothDisplayRoutePoints(filterDisplayRoutePoints(soloRun.state.acceptedRoute)).map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [soloRun.state.acceptedRoute],
  );

  useEffect(() => {
    if (!selectedCourse) {
      return;
    }
    addDiagnosticBreadcrumb(`virtual_run_opened:${course.id}`);
    let isMounted = true;
    async function prepare() {
      try {
        await showSafetyNoticeOnce();
        const created = await authenticatedPost<{ session: RunningSession }>("/running-sessions", {
          friendUserIds: [],
          locationSharingRequired: false,
          targetDistanceMeters: course.totalDistanceMeters,
          title: `Virtual: ${course.name}`,
          type: "solo",
          voiceFeedbackEnabled: true,
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
        setSetupStatus(didStartTracking ? "Virtual course started" : "Location permission is required to track this run.");
        addDiagnosticBreadcrumb(`virtual_run_started:${course.id}`);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const classified = classifyApiError(error, "Could not start virtual run.");
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
      Speech.stop();
    };
  }, [authenticatedPost, selectedCourse, soloRun.start]);

  useEffect(() => {
    const checkpoint = virtualCourse.currentCheckpoint;
    if (!checkpoint || announcedCheckpointIdsRef.current.has(checkpoint.id)) {
      return;
    }
    announcedCheckpointIdsRef.current.add(checkpoint.id);
    addDiagnosticBreadcrumb(`checkpoint_reached:${checkpoint.id}`);
    setAudioStatus(`Checkpoint reached: ${checkpoint.landmarkName}`);
    Speech.speak(`${checkpoint.description} ${checkpoint.coachingNote}`, {
      language: "en-US",
      onError: () => setAudioStatus("Checkpoint voice guide failed"),
    });
  }, [virtualCourse.currentCheckpoint]);

  useEffect(() => {
    for (const ghostState of ghostStates) {
      const lastAnnouncedAt = lastGhostAnnouncementsRef.current[ghostState.ghost.id];
      if (!shouldAnnounceGhost(ghostState, lastAnnouncedAt)) {
        continue;
      }
      lastGhostAnnouncementsRef.current[ghostState.ghost.id] = Date.now();
      Speech.speak(buildGhostAnnouncement(ghostState), { language: "en-US" });
      break;
    }
  }, [ghostStates]);

  if (!selectedCourse) {
    return (
      <View style={styles.missing}>
        <Text style={styles.title}>Course unavailable</Text>
        <Text style={styles.statusText}>This virtual course could not be found.</Text>
        <PrimaryButton label="Back" onPress={onCancel} />
      </View>
    );
  }

  function confirmFinish() {
    Alert.alert("Finish virtual run?", "This will stop GPS tracking and show your virtual course result.", [
      { style: "cancel", text: "Keep Running" },
      { style: "destructive", text: "Finish", onPress: () => void finishVirtualRun() },
    ]);
  }

  async function finishVirtualRun() {
    if (isFinishing) {
      return;
    }
    setIsFinishing(true);
    Speech.stop();
    const result = soloRun.finish();
    if (!result) {
      setIsFinishing(false);
      return;
    }

    const summary = buildVirtualBaseResult(result, userId, sessionId);
    const virtualResult = buildVirtualResult(result, virtualCourse, ghostStates);
    if (!sessionId) {
      onFinish(
        {
          ...summary,
          saveError: "Virtual run could not connect to the API before starting.",
          saveStatus: "pending",
        },
        virtualResult,
      );
      setIsFinishing(false);
      return;
    }

    try {
      await uploadFinalVirtualLocation(authenticatedPost, sessionId, result);
      await authenticatedPost(`/running-sessions/${sessionId}/finish`, {});
      addDiagnosticBreadcrumb(`virtual_run_finished:${course.id}`);
      onFinish({ ...summary, saveStatus: "saved" }, virtualResult);
    } catch (error) {
      const classified = classifyApiError(error, "Could not save virtual run.");
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
      onFinish(pending, virtualResult);
    } finally {
      setIsFinishing(false);
    }
  }

  function confirmCancel() {
    if (soloRun.state.status === "idle" || soloRun.state.status === "finished") {
      onCancel();
      return;
    }
    Alert.alert("Leave virtual run?", "This run will not be saved if you leave before finishing.", [
      { style: "cancel", text: "Keep Running" },
      { style: "destructive", text: "Leave", onPress: onCancel },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: course.accentColor }]}>{course.city}</Text>
          <Text style={styles.title}>{course.name}</Text>
        </View>
        <Text style={styles.statusText}>{setupStatus}</Text>
      </View>

      <VirtualCourseMap
        completedCheckpoints={virtualCourse.completedCheckpoints}
        course={course}
        ghostStates={ghostStates}
        userDistanceMeters={virtualCourse.virtualDistanceMeters}
      />

      <LiveRunMap
        acceptedPointCount={soloRun.state.acceptedPointCount}
        currentPoint={soloRun.state.currentPoint}
        rejectedPointCount={soloRun.state.rejectedPointCount}
        route={displayRoute}
        statusText={formatGpsStatus(soloRun.state.accuracyMeters)}
        title="Real Route"
        trackingStatusText={soloRun.state.trackingMessage}
      />

      <Text style={styles.statusText}>{audioStatus}</Text>
      {soloRun.state.error ? <Text style={styles.errorText}>{soloRun.state.error}</Text> : null}

      <View style={styles.metricsRow}>
        <MetricTile label="Distance" value={`${(soloRun.state.distanceMeters / 1000).toFixed(2)} km`} tone="strong" />
        <MetricTile label="Time" value={formatElapsed(soloRun.state.elapsedSeconds)} />
      </View>
      <View style={styles.metricsRow}>
        <MetricTile label="Current Pace" value={`${formatPace(soloRun.state.currentPaceSecPerKm)}/km`} />
        <MetricTile label="Average Pace" value={`${formatPace(soloRun.state.averagePaceSecPerKm)}/km`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ghost Runners</Text>
        {ghostStates.map((ghostState) => (
          <GhostRunnerBadge key={ghostState.ghost.id} ghostState={ghostState} />
        ))}
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
}

async function showSafetyNoticeOnce(): Promise<void> {
  const acknowledged = await AsyncStorage.getItem(SAFETY_ACK_KEY);
  if (acknowledged === "true") {
    return;
  }
  await new Promise<void>((resolve) => {
    Alert.alert(
      "Run safely",
      "Keep watching your real surroundings while running. Use audio as a guide and avoid looking at the screen too often.",
      [{ text: "I Understand", onPress: () => resolve() }],
      { cancelable: false },
    );
  });
  await AsyncStorage.setItem(SAFETY_ACK_KEY, "true");
}

function buildVirtualBaseResult(result: SoloRunResult, userId: string, sessionId?: string): RunResultSummary {
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
        participantId: "virtual-local",
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

function buildVirtualResult(
  result: SoloRunResult,
  virtualCourse: ReturnType<typeof useVirtualCourse>,
  ghostStates: GhostState[],
): VirtualRunResultSummary {
  return {
    averagePaceSecPerKm: result.averagePaceSecPerKm,
    completedCheckpoints: virtualCourse.completedCheckpoints,
    course: virtualCourse.course,
    distanceMeters: result.distanceMeters,
    elapsedSeconds: result.elapsedSeconds,
    isCompleted: virtualCourse.isCompleted,
    overtakenGhosts: ghostStates
      .filter((ghostState) => ghostState.status === "overtaken")
      .map((ghostState) => ghostState.ghost),
    progressPercent: virtualCourse.progressPercent,
  };
}

async function uploadFinalVirtualLocation(
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

function fallbackCourse() {
  return getCourseById("new-york-marathon")!;
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
  missing: {
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    gap: 8,
  },
  kicker: {
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
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "900",
  },
  actions: {
    gap: 10,
    marginTop: "auto",
  },
});
