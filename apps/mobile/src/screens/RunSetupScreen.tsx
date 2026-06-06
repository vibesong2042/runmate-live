import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import type { RunningSession, RunningSessionParticipant } from "@runmate/shared";
import { ApiError, type FriendSummaryDto } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";

interface RunSetupScreenProps {
  accessToken?: string;
  authenticatedGet: <T>(path: string) => Promise<T>;
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>;
  onStart: (sessionId: string) => void;
  onCancel: () => void;
}

export function RunSetupScreen({ accessToken, authenticatedGet, authenticatedPost, onStart, onCancel }: RunSetupScreenProps) {
  const [shareLocation, setShareLocation] = useState(true);
  const [voice, setVoice] = useState(true);
  const [friends, setFriends] = useState<FriendSummaryDto[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [friendStatus, setFriendStatus] = useState("Loading friends...");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isMounted = true;
    authenticatedGet<{ friends?: FriendSummaryDto[] }>("/friends")
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const serverFriends = response.friends ?? [];
        setFriends(serverFriends);
        setSelectedFriendIds(new Set(serverFriends.map((friend) => friend.id)));
        setFriendStatus(serverFriends.length ? "Friends selected for this run" : "No friends connected yet");
      })
      .catch(() => {
        if (isMounted) {
          setFriends([]);
          setSelectedFriendIds(new Set());
          setFriendStatus("Could not load friends. Check API connection.");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [authenticatedGet]);

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((current) => {
      const next = new Set(current);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }

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
        friendUserIds: [...selectedFriendIds],
        locationSharingRequired: shareLocation,
        voiceFeedbackEnabled: voice,
      });
      await authenticatedPost(`/running-sessions/${created.session.id}/start`, {});
      onStart(created.session.id);
    } catch (error) {
      setError(getRunStartErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
        <Text style={styles.friendStatus}>{friendStatus}</Text>
        <Text style={styles.ready}>You - ready</Text>
        {friends.map((friend) => {
          const selected = selectedFriendIds.has(friend.id);
          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={friend.id}
              onPress={() => toggleFriend(friend.id)}
              style={[styles.friendRow, selected && styles.friendRowSelected]}
            >
              <View style={styles.friendCopy}>
                <Text style={styles.friendName}>{friend.nickname}</Text>
                <Text style={styles.friendMeta}>
                  {friend.runnerId ? `@${friend.runnerId} - ` : ""}
                  {selected ? "invited" : "not invited"}
                </Text>
              </View>
              <Text style={[styles.selectionState, selected && styles.selectionStateSelected]}>
                {selected ? "Selected" : "Tap to add"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton disabled={isStarting} label={isStarting ? "Starting..." : "Start"} onPress={createAndStartSession} />
        <PrimaryButton label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </ScrollView>
  );
}

function getRunStartErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Could not start the running session. Try again.";
  }
  if (error.status === 0) {
    return "API connection failed. Check your internet connection.";
  }
  if (error.status === 401) {
    return "Sign-in expired. Reopen the app and sign in again.";
  }
  if (error.status === 403) {
    return error.message || "Only accepted friends can be invited to this run.";
  }
  if (error.status >= 500) {
    return "Server error while starting the run. Try again in a moment.";
  }
  return error.message || "Could not start the running session.";
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 18,
    flexGrow: 1,
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
  friendStatus: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  friendRowSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5",
  },
  friendCopy: {
    flex: 1,
  },
  friendName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  friendMeta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  selectionState: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
  },
  selectionStateSelected: {
    color: "#0f766e",
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
