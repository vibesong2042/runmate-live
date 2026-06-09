import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ActivitiesResponseDto, RunningSessionInvitationsDto, RunningSessionResponseDto } from "../api/client";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";
import type { AppScreen } from "../state/app-state";

interface HomeScreenProps {
  authenticatedGet: <T>(path: string) => Promise<T>;
  error?: string;
  onJoinSession: (sessionId: string) => Promise<void>;
  onNavigate: (screen: AppScreen) => void;
}

export function HomeScreen({ authenticatedGet, error, onJoinSession, onNavigate }: HomeScreenProps) {
  const [invitations, setInvitations] = useState<RunningSessionResponseDto[]>([]);
  const [weeklyDistanceMeters, setWeeklyDistanceMeters] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [status, setStatus] = useState("Checking invited runs...");
  const [activityStatus, setActivityStatus] = useState("Loading activity summary...");

  useEffect(() => {
    let isMounted = true;
    authenticatedGet<RunningSessionInvitationsDto>("/running-sessions/invitations")
      .then((response) => {
        if (!isMounted) {
          return;
        }
        setInvitations(response.invitations);
        setStatus(response.invitations.length ? "Invited runs ready" : "No invited runs yet");
      })
      .catch(() => {
        if (isMounted) {
          setInvitations([]);
          setStatus("Invited runs unavailable");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [authenticatedGet]);

  useEffect(() => {
    let isMounted = true;
    authenticatedGet<ActivitiesResponseDto>("/activities")
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const weeklyActivities = response.activities.filter((activity) => Date.parse(activity.createdAt) >= sevenDaysAgo);
        setWeeklyDistanceMeters(
          weeklyActivities.reduce((total, activity) => total + activity.distanceMeters, 0),
        );
        setActivityCount(response.activities.length);
        setActivityStatus(response.activities.length ? "Activity summary synced" : "No completed runs yet");
      })
      .catch(() => {
        if (isMounted) {
          setWeeklyDistanceMeters(0);
          setActivityCount(0);
          setActivityStatus("Activity summary unavailable");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [authenticatedGet]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View>
        <Text style={styles.kicker}>Today</Text>
        <Text style={styles.title}>Start a remote 5K with your friends.</Text>
      </View>

      <View style={styles.metricsRow}>
        <MetricTile label="This Week" value={`${(weeklyDistanceMeters / 1000).toFixed(1)} km`} tone="strong" />
        <MetricTile label="Runs" value={`${activityCount}`} />
      </View>
      <Text style={styles.statusText}>{activityStatus}</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton label="Run With Friends" onPress={() => onNavigate("runSetup")} />
        <PrimaryButton label="Invite Friends" variant="secondary" onPress={() => onNavigate("friends")} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invited Runs</Text>
        <Text style={styles.statusText}>{status}</Text>
        {invitations.map((invitation) => {
          const host = invitation.participantSummaries?.find((participant) => participant.isHost);
          return (
            <View key={invitation.session.id} style={styles.friendRun}>
              <View style={styles.inviteCopy}>
                <Text style={styles.friendName}>{invitation.session.title}</Text>
                <Text style={styles.friendMeta}>
                  Host {host?.nickname ?? "Runner"} - {invitation.session.status}
                </Text>
              </View>
              <PrimaryButton label="Join" variant="secondary" onPress={() => void onJoinSession(invitation.session.id)} />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
  },
  kicker: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
  },
  title: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actions: {
    gap: 10,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  friendRun: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  inviteCopy: {
    flex: 1,
  },
  friendName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  friendMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
  },
  statusText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "800",
  },
});
