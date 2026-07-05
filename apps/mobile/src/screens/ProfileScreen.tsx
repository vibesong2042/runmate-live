import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { formatPace, type ActivityRecord } from "@runmate/shared";
import type { ActivitiesResponseDto } from "../api/client";
import { MetricTile } from "../components/MetricTile";
import { loadVirtualRunHistory } from "../storage/virtual-run-history";
import type { VirtualRunHistoryEntry } from "../types/virtualCourse";
import { buildRewardBadges } from "../utils/badges";

interface ProfileScreenProps {
  authenticatedGet: <T>(path: string) => Promise<T>;
  userId: string;
}

export function ProfileScreen({ authenticatedGet, userId }: ProfileScreenProps) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [virtualRuns, setVirtualRuns] = useState<VirtualRunHistoryEntry[]>([]);
  const [status, setStatus] = useState("Loading activity records...");
  const totalDistanceMeters = useMemo(
    () => activities.reduce((total, activity) => total + activity.distanceMeters, 0),
    [activities],
  );
  const recentActivities = activities.slice(0, 5);
  const badges = useMemo(() => buildRewardBadges({ activities, virtualRuns }), [activities, virtualRuns]);

  useEffect(() => {
    let isMounted = true;
    authenticatedGet<ActivitiesResponseDto>("/activities")
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const sorted = [...response.activities].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        setActivities(sorted);
        setStatus(sorted.length ? "Activity records synced" : "No completed runs yet");
      })
      .catch(() => {
        if (isMounted) {
          setActivities([]);
          setStatus("Activity records unavailable");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [authenticatedGet]);

  useEffect(() => {
    let isMounted = true;
    loadVirtualRunHistory(userId).then((history) => {
      if (isMounted) {
        setVirtualRuns(history.slice(0, 5));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.metricsRow}>
        <MetricTile label="Total Distance" value={`${(totalDistanceMeters / 1000).toFixed(1)} km`} tone="strong" />
        <MetricTile label="Runs" value={`${activities.length}`} />
      </View>
      <Text style={styles.statusText}>{status}</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Recent Runs</Text>
        {recentActivities.length ? (
          recentActivities.map((activity) => (
            <View key={activity.id} style={styles.activityRow}>
              <View>
                <Text style={styles.activityTitle}>{formatActivityDate(activity.createdAt)}</Text>
                <Text style={styles.activityMeta}>
                  {(activity.distanceMeters / 1000).toFixed(2)} km - {formatElapsed(activity.durationSeconds)}
                </Text>
              </View>
              <Text style={styles.activityPace}>{formatPace(activity.averagePaceSecPerKm)}/km</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Finish a run to save your first activity.</Text>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Virtual Runs</Text>
        {virtualRuns.length ? (
          virtualRuns.map((run) => (
            <View key={run.id} style={styles.activityRow}>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>{run.course.name}</Text>
                <Text style={styles.activityMeta}>
                  {(run.distanceMeters / 1000).toFixed(2)} km - {Math.round(run.progressPercent)}% -{" "}
                  {formatActivityDate(run.completedAt)}
                </Text>
              </View>
              <Text style={styles.activityPace}>{run.isCompleted ? "Done" : `${run.completedCheckpoints.length} CP`}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Virtual course details appear after your first virtual run.</Text>
        )}
        <Text style={styles.emptyText}>Virtual details are stored on this phone and are lost if the app is reinstalled.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Badges</Text>
        <View style={styles.badgeGrid}>
          {badges.map((badge) => {
            const isEarned = badge.status === "earned";
            return (
              <View key={badge.id} style={[styles.badgeCard, isEarned ? styles.badgeCardEarned : styles.badgeCardLocked]}>
                <View style={[styles.badgeIcon, isEarned ? styles.badgeIconEarned : styles.badgeIconLocked]}>
                  <Text style={[styles.badgeIconText, isEarned ? styles.badgeIconTextEarned : styles.badgeIconTextLocked]}>
                    {badge.shortLabel}
                  </Text>
                </View>
                <View style={styles.badgeCopy}>
                  <Text style={styles.badgeTitle}>{badge.label}</Text>
                  <Text style={styles.badgeDescription}>{isEarned ? "Earned" : badge.description}</Text>
                </View>
                <Text style={[styles.badgeStatus, isEarned ? styles.badgeStatusEarned : styles.badgeStatusLocked]}>
                  {isEarned ? "Earned" : "Locked"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatActivityDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent run";
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
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
  statusText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  activityTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  activityCopy: {
    flex: 1,
  },
  activityMeta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  activityPace: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "900",
  },
  badgeCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  badgeCardEarned: {
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
  },
  badgeCardLocked: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  badgeCopy: {
    flex: 1,
  },
  badgeDescription: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  badgeGrid: {
    gap: 8,
  },
  badgeIcon: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    height: 42,
    width: 42,
  },
  badgeIconEarned: {
    backgroundColor: "#0f766e",
  },
  badgeIconLocked: {
    backgroundColor: "#e2e8f0",
  },
  badgeIconText: {
    fontSize: 12,
    fontWeight: "900",
  },
  badgeIconTextEarned: {
    color: "#ffffff",
  },
  badgeIconTextLocked: {
    color: "#475569",
  },
  badgeStatus: {
    fontSize: 12,
    fontWeight: "900",
  },
  badgeStatusEarned: {
    color: "#0f766e",
  },
  badgeStatusLocked: {
    color: "#64748b",
  },
  badgeTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
  },
});
