import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { formatPace } from "@runmate/shared";
import { LiveRunMap } from "../components/LiveRunMap";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLiveRunTracker } from "../hooks/useLiveRunTracker";

interface LiveRunScreenProps {
  sessionId: string;
  accessToken: string;
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>;
  userId: string;
  onFinish: () => void;
}

export function LiveRunScreen({ sessionId, accessToken, authenticatedPost, userId, onFinish }: LiveRunScreenProps) {
  const [cheers, setCheers] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [route, setRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const tracker = useLiveRunTracker({ sessionId, userId, accessToken });
  const elapsedLabel = useMemo(() => formatElapsed(tracker.elapsedSeconds), [tracker.elapsedSeconds]);
  const currentPoint = useMemo(() => {
    if (tracker.latitude === undefined || tracker.longitude === undefined) {
      return undefined;
    }
    return {
      latitude: tracker.latitude,
      longitude: tracker.longitude,
    };
  }, [tracker.latitude, tracker.longitude]);
  const mapStatus = useMemo(() => {
    if (tracker.permissionStatus === "denied") {
      return "Location permission is disabled.";
    }
    if (tracker.lastLocationAt) {
      return `GPS ${Math.round(tracker.accuracyMeters ?? 0)}m - ${tracker.lastLocationAt.slice(11, 19)}`;
    }
    return "Waiting for GPS signal";
  }, [tracker.accuracyMeters, tracker.lastLocationAt, tracker.permissionStatus]);
  const syncStatusLabel = useMemo(() => {
    if (tracker.syncStatus === "demo") {
      return "Live sync: demo mode";
    }
    if (tracker.syncStatus === "open") {
      return "Live sync: connected";
    }
    if (tracker.syncStatus === "connecting") {
      return "Live sync: connecting";
    }
    if (tracker.syncStatus === "error" || tracker.syncStatus === "closed") {
      return "Live sync: offline, tracking locally";
    }
    return "Live sync: idle";
  }, [tracker.syncStatus]);

  useEffect(() => {
    void tracker.start();
  }, [tracker.start]);

  useEffect(() => {
    if (!currentPoint) {
      return;
    }
    setRoute((current) => {
      const previous = current[current.length - 1];
      if (previous?.latitude === currentPoint.latitude && previous.longitude === currentPoint.longitude) {
        return current;
      }
      return [...current, currentPoint].slice(-1000);
    });
  }, [currentPoint]);

  async function finishRun() {
    setIsFinishing(true);
    tracker.stop();
    try {
      await authenticatedPost(`/running-sessions/${sessionId}/finish`, {});
    } finally {
      setIsFinishing(false);
      onFinish();
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LiveRunMap currentPoint={currentPoint} route={route} statusText={mapStatus} />

      {tracker.error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{tracker.error}</Text>
          <PrimaryButton label="Retry Location" variant="secondary" onPress={() => void tracker.start()} />
        </View>
      ) : null}

      <View style={styles.metricsRow}>
        <MetricTile label="Distance" value={`${(tracker.distanceMeters / 1000).toFixed(2)} km`} tone="strong" />
        <MetricTile label="Average Pace" value={`${formatPace(tracker.averagePaceSecPerKm)}/km`} />
      </View>
      <View style={styles.metricsRow}>
        <MetricTile label="Time" value={elapsedLabel} />
        <MetricTile label="Current Pace" value={`${formatPace(tracker.currentPaceSecPerKm)}/km`} />
      </View>
      <View style={styles.metricsRow}>
        <MetricTile label="Minsu Gap" value="+120 m" />
        <MetricTile label="Cheers" value={`${cheers}`} />
      </View>

      <View style={styles.friendPanel}>
        <Text style={styles.sectionTitle}>Group Status</Text>
        <Text style={styles.syncLine}>{syncStatusLabel}</Text>
        <Text style={styles.friendLine}>
          You - {(tracker.distanceMeters / 1000).toFixed(2)} km - {formatPace(tracker.averagePaceSecPerKm)}/km
        </Text>
        <Text style={styles.friendLine}>Minsu - 1.12 km - 5:48/km</Text>
        <Text style={styles.friendLine}>Jihyun - 0.96 km - 6:12/km</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Send Cheer" variant="secondary" onPress={() => setCheers((value) => value + 1)} />
        <PrimaryButton label={isFinishing ? "Finishing..." : "Finish"} variant="danger" onPress={finishRun} />
      </View>
    </ScrollView>
  );
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  errorPanel: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    padding: 14,
  },
  errorText: {
    color: "#be123c",
    fontSize: 14,
    fontWeight: "700",
  },
  friendPanel: {
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "900",
  },
  friendLine: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  syncLine: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
  },
  actions: {
    gap: 10,
  },
});
