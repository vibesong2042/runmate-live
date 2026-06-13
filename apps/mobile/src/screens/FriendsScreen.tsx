import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, type FriendSummaryDto } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { classifyApiError } from "../utils/error-messages";

interface FriendsScreenProps {
  authenticatedGet: <T>(path: string) => Promise<T>;
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>;
  onStartRun: () => void;
}

export function FriendsScreen({ authenticatedGet, authenticatedPost, onStartRun }: FriendsScreenProps) {
  const [friends, setFriends] = useState<FriendSummaryDto[]>([]);
  const [createdInviteCode, setCreatedInviteCode] = useState<string>();
  const [enteredInviteCode, setEnteredInviteCode] = useState("");
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [status, setStatus] = useState("Loading friends...");

  useEffect(() => {
    let isMounted = true;
    authenticatedGet<{ friends?: FriendSummaryDto[] }>("/friends")
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const serverFriends = response.friends ?? [];
        setFriends(serverFriends);
        setStatus(serverFriends.length ? "Friends synced" : "No friends connected yet");
      })
      .catch(() => {
        if (isMounted) {
          setFriends([]);
          setStatus("Could not load friends. Check API connection.");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [authenticatedGet]);

  async function createInviteLink() {
    setStatus("Creating invite...");
    try {
      const response = await authenticatedPost<{ inviteCode: string }>("/invites/friend-link", {});
      setCreatedInviteCode(response.inviteCode);
      setStatus("Invite ready");
    } catch {
      setCreatedInviteCode(undefined);
      setStatus("Could not create invite. Check API connection.");
    }
  }

  async function acceptInviteCode() {
    const normalizedCode = enteredInviteCode.trim().toUpperCase();
    if (!normalizedCode) {
      setStatus("Enter a friend invite code first");
      return;
    }
    setIsAcceptingInvite(true);
    setStatus("Accepting invite...");
    try {
      const response = await authenticatedPost<{ friend?: FriendSummaryDto }>("/invites/friend-link/accept", {
        inviteCode: normalizedCode,
      });
      if (response.friend) {
        setFriends((current) => {
          const withoutDuplicate = current.filter((friend) => friend.id !== response.friend?.id);
          return [response.friend!, ...withoutDuplicate];
        });
      }
      await refreshFriends().catch(() => undefined);
      setEnteredInviteCode("");
      setStatus("Friend added");
    } catch (error) {
      setStatus(getInviteAcceptErrorMessage(error));
    } finally {
      setIsAcceptingInvite(false);
    }
  }

  async function refreshFriends() {
    const response = await authenticatedGet<{ friends?: FriendSummaryDto[] }>("/friends");
    setFriends(response.friends ?? []);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Friends</Text>
      <PrimaryButton label="Create Invite Link" onPress={createInviteLink} />
      <View style={styles.statusPanel}>
        <Text style={styles.statusText}>{status}</Text>
        {createdInviteCode ? <Text style={styles.inviteCode}>Invite code: {createdInviteCode}</Text> : null}
      </View>

      <View style={styles.invitePanel}>
        <Text style={styles.sectionTitle}>Accept Invite</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isAcceptingInvite}
          onChangeText={(value) => setEnteredInviteCode(value.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase())}
          placeholder="Enter friend code"
          style={styles.input}
          value={enteredInviteCode}
        />
        <PrimaryButton
          disabled={isAcceptingInvite || !enteredInviteCode.trim()}
          label={isAcceptingInvite ? "Adding..." : "Add Friend"}
          onPress={acceptInviteCode}
        />
      </View>

      <Text style={styles.sectionTitle}>Friend List</Text>
      {friends.length ? (
        friends.map((friend) => (
          <View key={friend.id} style={styles.friend}>
            <View>
              <Text style={styles.name}>{friend.nickname}</Text>
              <Text style={styles.meta}>
                {friend.runnerId ? `@${friend.runnerId} - ` : ""}
                {friend.status === "running" ? `running - ${friend.currentPace}/km` : friend.status}
              </Text>
            </View>
            <PrimaryButton label="Run" variant="secondary" onPress={onStartRun} />
          </View>
        ))
      ) : (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyText}>No friends connected yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function getInviteAcceptErrorMessage(error: unknown): string {
  const classified = classifyApiError(error, "Could not accept invite.");
  if (classified.kind === "network" || classified.kind === "timeout" || classified.kind === "rate_limit") {
    return classified.message;
  }
  if (!(error instanceof ApiError)) {
    return "Could not accept invite. Try again.";
  }
  if (error.status === 404) {
    return "Invite code was not found. Ask your friend to create a new code.";
  }
  if (error.status === 410) {
    return "Invite code expired. Ask your friend to create a new one.";
  }
  if (error.status === 400) {
    return error.message || "Invite code is not valid.";
  }
  if (error.status === 0) {
    return classified.message;
  }
  if (error.status >= 500) {
    return classified.message;
  }
  return "Could not accept invite. Check the code and API connection.";
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
  statusPanel: {
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    padding: 12,
  },
  statusText: {
    color: "#1e3a8a",
    fontSize: 13,
    fontWeight: "700",
  },
  inviteCode: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  invitePanel: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
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
  friend: {
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
  emptyPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
  },
  name: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
  },
});
