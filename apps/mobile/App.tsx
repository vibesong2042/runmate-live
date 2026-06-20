import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Platform, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from "react-native";
import * as Network from "expo-network";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LiveRunScreen } from "./src/screens/LiveRunScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ResultScreen, type RunResultSummary } from "./src/screens/ResultScreen";
import { RunSetupScreen } from "./src/screens/RunSetupScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { CourseSelectScreen } from "./src/screens/solo/CourseSelectScreen";
import { SoloModeSelectScreen } from "./src/screens/solo/SoloModeSelectScreen";
import { SoloRunScreen } from "./src/screens/solo/SoloRunScreen";
import { VirtualRunResultScreen } from "./src/screens/solo/VirtualRunResultScreen";
import { VirtualRunScreen } from "./src/screens/solo/VirtualRunScreen";
import type { VirtualRunResultSummary } from "./src/types/virtualCourse";
import { useAuthSession } from "./src/hooks/useAuthSession";
import {
  loadPendingRunResults,
  removePendingRunResult,
  savePendingRunResult,
  type PendingRunResult,
} from "./src/storage/pending-run-results";
import { updateVirtualRunHistorySaveStatus } from "./src/storage/virtual-run-history";
import type { AppScreen } from "./src/state/app-state";
import { ApiError } from "./src/api/client";
import { initializeSentry, withSentry } from "./src/monitoring/sentry";
import { classifyApiError } from "./src/utils/error-messages";

initializeSentry();

const tabs: Array<{ screen: AppScreen; label: string }> = [
  { screen: "home", label: "Home" },
  { screen: "friends", label: "Friends" },
  { screen: "profile", label: "Profile" },
  { screen: "settings", label: "Settings" },
];

function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

export default withSentry(App);

function AppShell() {
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [selectedCourseId, setSelectedCourseId] = useState<string>();
  const [lastRunResult, setLastRunResult] = useState<RunResultSummary>();
  const [lastVirtualRunResult, setLastVirtualRunResult] = useState<VirtualRunResultSummary>();
  const [isRetryingSave, setIsRetryingSave] = useState(false);
  const [pendingResults, setPendingResults] = useState<PendingRunResult[]>([]);
  const [pendingSaveStatus, setPendingSaveStatus] = useState<string>();
  const [homeError, setHomeError] = useState<string>();
  const auth = useAuthSession();

  const refreshPendingResults = useCallback(async () => {
    if (!auth.session) {
      setPendingResults([]);
      return [];
    }
    const results = await loadPendingRunResults(auth.session.user.id);
    setPendingResults(results);
    return results;
  }, [auth.session]);

  const retryPendingEntry = useCallback(
    async (entry: PendingRunResult, automatic = false) => {
      if (!entry.sessionId || !auth.session) {
        return false;
      }
      if (automatic && (entry.autoRetryDisabled || (entry.retryCount ?? 0) >= 3)) {
        if (!entry.autoRetryDisabled) {
          await savePendingRunResult({ ...entry, autoRetryDisabled: true });
          await refreshPendingResults();
        }
        return false;
      }

      setIsRetryingSave(true);
      setPendingSaveStatus(automatic ? "Retrying pending save automatically..." : "Retrying pending save...");
      try {
        await uploadPendingLastLocation(auth.authenticatedPost, entry);
        await auth.authenticatedPost(`/running-sessions/${entry.sessionId}/finish`, {});
        await removePendingRunResult(entry.id);
        await updateVirtualRunHistorySaveStatus(auth.session.user.id, entry.sessionId, "saved");
        await refreshPendingResults();
        if (lastRunResult?.pendingResultId === entry.id) {
          setLastRunResult({
            ...lastRunResult,
            pendingResultId: undefined,
            saveError: undefined,
            saveStatus: "saved",
          });
        }
        setPendingSaveStatus("Run result saved.");
        showToast("Run result saved.");
        return true;
      } catch (error) {
        const classified = classifyApiError(error, "The API is still unavailable.");
        const retryCount = (entry.retryCount ?? 0) + 1;
        const nextEntry: PendingRunResult = {
          ...entry,
          autoRetryDisabled: retryCount >= 3,
          lastError: classified.message,
          lastRetryAt: new Date().toISOString(),
          retryCount,
          result: {
            ...entry.result,
            saveError: classified.message,
            saveStatus: "failed",
          },
        };
        await savePendingRunResult(nextEntry);
        await updateVirtualRunHistorySaveStatus(auth.session.user.id, entry.sessionId, "failed");
        await refreshPendingResults();
        setPendingSaveStatus(
          nextEntry.autoRetryDisabled
            ? "Automatic retry stopped. Use Retry Now when the server is available."
            : classified.message,
        );
        return false;
      } finally {
        setIsRetryingSave(false);
      }
    },
    [auth, lastRunResult, refreshPendingResults],
  );

  const retryFirstPendingSave = useCallback(
    async (automatic = false) => {
      const entries = pendingResults.length ? pendingResults : await refreshPendingResults();
      const target = entries.find((entry) => !automatic || !entry.autoRetryDisabled);
      if (!target) {
        setPendingSaveStatus("No pending run results.");
        return;
      }
      await retryPendingEntry(target, automatic);
    },
    [pendingResults, refreshPendingResults, retryPendingEntry],
  );

  useEffect(() => {
    let isMounted = true;
    async function loadPendingResults() {
      if (!hasOnboarded || !auth.session) {
        return;
      }
      const results = await loadPendingRunResults(auth.session.user.id);
      if (isMounted) {
        setPendingResults(results);
      }
    }

    void loadPendingResults();
    return () => {
      isMounted = false;
    };
  }, [auth.session, hasOnboarded]);

  useEffect(() => {
    if (!hasOnboarded || !auth.session) {
      return;
    }
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }
      void Network.getNetworkStateAsync().then((networkState) => {
        if (networkState.isConnected) {
          void retryFirstPendingSave(true);
        }
      });
    });
    void Network.getNetworkStateAsync().then((networkState) => {
      if (networkState.isConnected) {
        void retryFirstPendingSave(true);
      }
    });
    return () => subscription.remove();
  }, [auth.session, hasOnboarded, retryFirstPendingSave]);

  const retryPendingResultSave = useCallback(
    async (result: RunResultSummary) => {
      if (!result.sessionId || !result.pendingResultId || !auth.session) {
        return;
      }

      setIsRetryingSave(true);
      setLastRunResult({ ...result, saveStatus: "retrying" });
      try {
        const pending = (await loadPendingRunResults(auth.session.user.id)).find((entry) => entry.id === result.pendingResultId);
        if (pending) {
          await retryPendingEntry(pending, false);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "The API is still unavailable.";
        const failedResult: RunResultSummary = {
          ...result,
          saveError: message,
          saveStatus: "failed",
        };
        setLastRunResult(failedResult);
        await savePendingRunResult({
          id: result.pendingResultId,
          userId: auth.session.user.id,
          sessionId: result.sessionId,
          result: failedResult,
          createdAt: new Date().toISOString(),
          lastRetryAt: new Date().toISOString(),
          lastError: message,
          retryCount: 1,
        });
      } finally {
        setIsRetryingSave(false);
      }
    },
    [auth, retryPendingEntry],
  );

  const activeScreen = useMemo(() => {
    if (!hasOnboarded) {
      return (
        <OnboardingScreen
          error={auth.error}
          isLoading={auth.isSigningIn}
          onDone={async (profile) => {
            const session = await auth.signIn(profile);
            if (session) {
              setHasOnboarded(true);
            }
          }}
        />
      );
    }

    if (screen === "home" && auth.session) {
      return (
        <HomeScreen
          authenticatedGet={auth.authenticatedGet}
          error={homeError}
          isRetryingPendingSave={isRetryingSave}
          onJoinSession={async (sessionId) => {
            setHomeError(undefined);
            try {
              await auth.authenticatedPost(`/running-sessions/${sessionId}/join`, {});
              setActiveSessionId(sessionId);
              setScreen("liveRun");
            } catch (error) {
              setHomeError(getJoinErrorMessage(error));
            }
          }}
          onNavigate={setScreen}
          onRetryPendingSave={() => void retryFirstPendingSave(false)}
          pendingSaveStatus={pendingSaveStatus}
          pendingRunResultCount={pendingResults.length}
          userId={auth.session.user.id}
        />
      );
    }
    if (screen === "friends") {
      return (
        <FriendsScreen
          authenticatedGet={auth.authenticatedGet}
          authenticatedPost={auth.authenticatedPost}
          onStartRun={() => setScreen("runSetup")}
        />
      );
    }
    if (screen === "runSetup") {
      return (
        <RunSetupScreen
          onCancel={() => setScreen("home")}
          accessToken={auth.session?.accessToken}
          authenticatedGet={auth.authenticatedGet}
          authenticatedPost={auth.authenticatedPost}
          onStart={(sessionId) => {
            setActiveSessionId(sessionId);
            setScreen("liveRun");
          }}
        />
      );
    }
    if (screen === "soloModeSelect") {
      return (
        <SoloModeSelectScreen
          onBack={() => setScreen("home")}
          onSelectStandard={() => setScreen("soloRun")}
          onSelectVirtual={() => setScreen("courseSelect")}
        />
      );
    }
    if (screen === "courseSelect" && auth.session) {
      return (
        <CourseSelectScreen
          onBack={() => setScreen("soloModeSelect")}
          onSelectCourse={(courseId) => {
            setSelectedCourseId(courseId);
            setScreen("virtualRun");
          }}
          userId={auth.session.user.id}
        />
      );
    }
    if (screen === "soloRun" && auth.session) {
      return (
        <SoloRunScreen
          authenticatedPost={auth.authenticatedPost}
          onCancel={() => setScreen("home")}
          onFinish={(result) => {
            setLastRunResult(result);
            setScreen("result");
          }}
          userId={auth.session.user.id}
        />
      );
    }
    if (screen === "virtualRun" && auth.session && selectedCourseId) {
      return (
        <VirtualRunScreen
          authenticatedPost={auth.authenticatedPost}
          courseId={selectedCourseId}
          onCancel={() => setScreen("courseSelect")}
          onFinish={(result, virtualResult) => {
            setLastRunResult(result);
            setLastVirtualRunResult(virtualResult);
            setScreen("virtualRunResult");
          }}
          userId={auth.session.user.id}
        />
      );
    }
    if (screen === "liveRun" && activeSessionId && auth.session) {
      return (
        <LiveRunScreen
          sessionId={activeSessionId}
          accessToken={auth.session.accessToken}
          getAccessToken={auth.getAccessToken}
          authenticatedGet={auth.authenticatedGet}
          authenticatedPost={auth.authenticatedPost}
          userId={auth.session.user.id}
          onFinish={(result) => {
            setLastRunResult(result);
            setScreen("result");
          }}
        />
      );
    }
    if (screen === "result") {
      return (
        <ResultScreen
          isRetryingSave={isRetryingSave}
          result={lastRunResult}
          onRetrySave={(result) => void retryPendingResultSave(result)}
          onDone={() => {
            setActiveSessionId(undefined);
            setLastRunResult(undefined);
            setScreen("home");
          }}
        />
      );
    }
    if (screen === "virtualRunResult") {
      return (
        <VirtualRunResultScreen
          isRetryingSave={isRetryingSave}
          result={lastRunResult}
          virtualResult={lastVirtualRunResult}
          onRetrySave={(result) => void retryPendingResultSave(result)}
          onDone={() => {
            setSelectedCourseId(undefined);
            setLastRunResult(undefined);
            setLastVirtualRunResult(undefined);
            setScreen("home");
          }}
        />
      );
    }
    if (screen === "profile" && auth.session) {
      return <ProfileScreen authenticatedGet={auth.authenticatedGet} userId={auth.session.user.id} />;
    }
    return (
      <SettingsScreen
        authStatus={auth.authStatus}
        isRetryingPendingSave={isRetryingSave}
        onRetryPendingSave={() => void retryFirstPendingSave(false)}
        pendingResults={pendingResults}
        pendingSaveStatus={pendingSaveStatus}
      />
    );
  }, [
    activeSessionId,
    auth,
    hasOnboarded,
    homeError,
    isRetryingSave,
    lastRunResult,
    lastVirtualRunResult,
    pendingResults,
    pendingSaveStatus,
    retryFirstPendingSave,
    retryPendingResultSave,
    screen,
    selectedCourseId,
  ]);

  return (
    <SafeAreaView edges={["top", "right", "bottom", "left"]} style={styles.safeArea}>
      <View style={styles.app}>{activeScreen}</View>
      {hasOnboarded &&
      !["soloModeSelect", "courseSelect", "soloRun", "virtualRun", "virtualRunResult", "runSetup", "liveRun", "result"].includes(
        screen,
      ) ? (
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={tab.screen}
              onPress={() => setScreen(tab.screen)}
              style={[styles.tab, screen === tab.screen && styles.activeTab]}
            >
              <Text style={[styles.tabText, screen === tab.screen && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

async function uploadPendingLastLocation(
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>,
  entry: PendingRunResult,
): Promise<void> {
  const point = entry.result.lastPoint;
  if (!point) {
    return;
  }
  await authenticatedPost(`/running-sessions/${entry.sessionId}/locations`, {
    accuracyMeters: point.accuracyMeters,
    altitude: point.altitude,
    averagePaceSecPerKm: entry.result.averagePaceSecPerKm,
    currentPaceSecPerKm: undefined,
    distanceMeters: entry.result.distanceMeters,
    latitude: point.latitude,
    longitude: point.longitude,
    recordedAt: point.recordedAt ?? new Date().toISOString(),
    state: "finished",
  });
}

function getJoinErrorMessage(error: unknown): string {
  const classified = classifyApiError(error, "Could not join the running session.");
  if (classified.kind !== "unknown") {
    return classified.message;
  }
  if (!(error instanceof ApiError)) {
    return "Could not join the running session. Try again.";
  }
  if (error.status === 0) {
    return "API connection failed. Check your internet connection.";
  }
  if (error.status === 401) {
    return "Sign-in expired. Reopen the app and sign in again.";
  }
  if (error.status === 403) {
    return "You can join only runs where you are invited.";
  }
  if (error.status >= 500) {
    return "Server error while joining the run. Try again in a moment.";
  }
  return error.message || "Could not join the running session.";
}

function showToast(message: string): void {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  app: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    borderRadius: 8,
    paddingVertical: 10,
  },
  activeTab: {
    backgroundColor: "#0f766e",
  },
  tabText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  activeTabText: {
    color: "#ffffff",
  },
});
