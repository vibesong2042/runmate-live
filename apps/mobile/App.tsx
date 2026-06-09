import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LiveRunScreen } from "./src/screens/LiveRunScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ResultScreen, type RunResultSummary } from "./src/screens/ResultScreen";
import { RunSetupScreen } from "./src/screens/RunSetupScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { useAuthSession } from "./src/hooks/useAuthSession";
import { loadPendingRunResults, removePendingRunResult, savePendingRunResult } from "./src/storage/pending-run-results";
import type { AppScreen } from "./src/state/app-state";
import { ApiError } from "./src/api/client";
import { initializeSentry, withSentry } from "./src/monitoring/sentry";

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
  const [lastRunResult, setLastRunResult] = useState<RunResultSummary>();
  const [isRetryingSave, setIsRetryingSave] = useState(false);
  const [homeError, setHomeError] = useState<string>();
  const auth = useAuthSession();

  useEffect(() => {
    let isMounted = true;
    async function loadPendingResult() {
      if (!hasOnboarded || !auth.session || lastRunResult?.pendingResultId) {
        return;
      }

      const pendingResults = await loadPendingRunResults(auth.session.user.id);
      const pending = pendingResults[0];
      if (!isMounted || !pending) {
        return;
      }

      setLastRunResult({
        ...pending.result,
        pendingResultId: pending.id,
        saveStatus: pending.result.saveStatus ?? "pending",
        sessionId: pending.sessionId,
      });
      setScreen("result");
    }

    void loadPendingResult();
    return () => {
      isMounted = false;
    };
  }, [auth.session, hasOnboarded, lastRunResult?.pendingResultId]);

  const retryPendingResultSave = useCallback(
    async (result: RunResultSummary) => {
      if (!result.sessionId || !result.pendingResultId || !auth.session) {
        return;
      }

      setIsRetryingSave(true);
      setLastRunResult({ ...result, saveStatus: "retrying" });
      try {
        await auth.authenticatedPost(`/running-sessions/${result.sessionId}/finish`, {});
        await removePendingRunResult(result.pendingResultId);
        setLastRunResult({
          ...result,
          pendingResultId: undefined,
          saveError: undefined,
          saveStatus: "saved",
        });
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
          lastError: message,
        });
      } finally {
        setIsRetryingSave(false);
      }
    },
    [auth],
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

    if (screen === "home") {
      return (
        <HomeScreen
          authenticatedGet={auth.authenticatedGet}
          error={homeError}
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
    if (screen === "profile") {
      return <ProfileScreen authenticatedGet={auth.authenticatedGet} />;
    }
    return <SettingsScreen authStatus={auth.authStatus} />;
  }, [activeSessionId, auth, hasOnboarded, homeError, isRetryingSave, lastRunResult, retryPendingResultSave, screen]);

  return (
    <SafeAreaView edges={["top", "right", "bottom", "left"]} style={styles.safeArea}>
      <View style={styles.app}>{activeScreen}</View>
      {hasOnboarded && !["runSetup", "liveRun", "result"].includes(screen) ? (
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

function getJoinErrorMessage(error: unknown): string {
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
