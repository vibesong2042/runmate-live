import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from "react-native";
import * as Speech from "expo-speech";
import { useKeepAwake } from "expo-keep-awake";
import { filterDisplayRoutePoints, formatPace, smoothDisplayRoutePoints, type GeoPoint } from "@runmate/shared";
import {
  ApiError,
  type RunningSessionFinishResponseDto,
  type RunningSessionResponseDto,
  type SessionParticipantSummaryDto,
} from "../api/client";
import { LiveRunMap, type LatLng, type MapPin } from "../components/LiveRunMap";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";
import { useLiveRunTracker } from "../hooks/useLiveRunTracker";
import { savePendingRunResult } from "../storage/pending-run-results";
import { classifyApiError } from "../utils/error-messages";
import type { RunResultSummary } from "./ResultScreen";

interface LiveRunScreenProps {
  sessionId: string;
  accessToken: string;
  getAccessToken: () => Promise<string>;
  authenticatedGet: <T>(path: string) => Promise<T>;
  authenticatedPost: <T>(path: string, body?: unknown) => Promise<T>;
  userId: string;
  onFinish: (result: RunResultSummary) => void;
}

type LiveMapMode = "together" | "overview" | "mine";

const LONG_DISTANCE_GROUP_THRESHOLD_METERS = 50_000;
const MAX_ROUTE_POINTS = 1000;

export function LiveRunScreen({
  sessionId,
  accessToken,
  getAccessToken,
  authenticatedGet,
  authenticatedPost,
  userId,
  onFinish,
}: LiveRunScreenProps) {
  useKeepAwake("runmate-live-run");
  const [cheerStatus, setCheerStatus] = useState("No cheers yet");
  const [hasFailedCheer, setHasFailedCheer] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [mapMode, setMapMode] = useState<LiveMapMode>("together");
  const [route, setRoute] = useState<GeoPoint[]>([]);
  const [remoteRoutes, setRemoteRoutes] = useState<Record<string, GeoPoint[]>>({});
  const [participants, setParticipants] = useState<SessionParticipantSummaryDto[]>([]);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState<string>();
  const [voiceStatus, setVoiceStatus] = useState("Voice preparing...");
  const [hasSpokenStart, setHasSpokenStart] = useState(false);
  const [nextVoiceMilestoneMeters, setNextVoiceMilestoneMeters] = useState(500);
  const [spokenCheerId, setSpokenCheerId] = useState<string>();
  const tracker = useLiveRunTracker({ sessionId, userId, accessToken, getAccessToken });
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
  const currentRoutePoint = useMemo<GeoPoint | undefined>(() => {
    if (tracker.latitude === undefined || tracker.longitude === undefined || !tracker.lastLocationAt) {
      return undefined;
    }
    return {
      latitude: tracker.latitude,
      longitude: tracker.longitude,
      accuracyMeters: tracker.accuracyMeters,
      recordedAt: tracker.lastLocationAt,
    };
  }, [tracker.accuracyMeters, tracker.lastLocationAt, tracker.latitude, tracker.longitude]);
  const displayRoute = useMemo(
    () => smoothDisplayRoutePoints(route).map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    [route],
  );
  const remoteDisplayRoutes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(remoteRoutes).map(([remoteUserId, remoteRoute]) => [
          remoteUserId,
          smoothDisplayRoutePoints(remoteRoute).map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          })),
        ]),
      ) as Record<string, LatLng[]>,
    [remoteRoutes],
  );
  const mapStatus = useMemo(() => {
    if (tracker.permissionStatus === "denied") {
      return "Location permission is disabled.";
    }
    if (tracker.lastLocationAt) {
      return `GPS ${Math.round(tracker.accuracyMeters ?? 0)}m - ${tracker.lastLocationAt.slice(11, 19)}`;
    }
    return "Waiting for GPS signal";
  }, [tracker.accuracyMeters, tracker.lastLocationAt, tracker.permissionStatus]);
  const distanceTrackingLabel = useMemo(
    () => formatDistanceTrackingStatus(tracker.trackingQuality),
    [tracker.trackingQuality],
  );
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
    if (tracker.syncStatus === "reconnecting") {
      return "Live sync: reconnecting, tracking locally";
    }
    if (tracker.syncStatus === "error" || tracker.syncStatus === "closed") {
      return "Live sync: offline, tracking locally";
    }
    if (tracker.syncStatus === "offline") {
      return "Live sync: offline, run is saved locally";
    }
    return "Live sync: idle";
  }, [tracker.syncStatus]);
  const syncBanner = useMemo(() => {
    if (tracker.syncStatus === "reconnecting") {
      return `Reconnecting live sync - attempt ${tracker.reconnectAttempt}`;
    }
    if (tracker.syncStatus === "offline") {
      return "Server connection failed - run is saved locally";
    }
    if (tracker.pendingLocationUpdates > 0) {
      return `${tracker.pendingLocationUpdates} route points waiting to sync`;
    }
    return undefined;
  }, [tracker.pendingLocationUpdates, tracker.reconnectAttempt, tracker.syncStatus]);
  const participantRows = useMemo<SessionParticipantSummaryDto[]>(() => {
    const serverRows = participants.length
      ? participants
      : [
          {
            participantId: "local",
            userId,
            nickname: "You",
            isHost: true,
            status: "running" as const,
            totalDistanceMeters: tracker.distanceMeters,
            movingTimeSeconds: tracker.elapsedSeconds,
            averagePaceSecPerKm: tracker.averagePaceSecPerKm,
            currentPaceSecPerKm: tracker.currentPaceSecPerKm,
          },
        ];
    return serverRows.map((participant) => {
      const remoteLocation = tracker.remoteLocations[participant.userId];
      const remoteStatus = tracker.participantStatuses[participant.userId];
      if (participant.userId === userId) {
        return {
          ...participant,
          nickname: "You",
          totalDistanceMeters: tracker.distanceMeters,
          movingTimeSeconds: tracker.elapsedSeconds,
          averagePaceSecPerKm: tracker.averagePaceSecPerKm,
          currentPaceSecPerKm: tracker.currentPaceSecPerKm,
          status: tracker.isTracking ? "running" : participant.status,
        };
      }
      return {
        ...participant,
        totalDistanceMeters: remoteLocation?.distanceMeters ?? participant.totalDistanceMeters,
        averagePaceSecPerKm: remoteLocation?.averagePaceSecPerKm ?? participant.averagePaceSecPerKm,
        currentPaceSecPerKm: remoteLocation?.currentPaceSecPerKm ?? participant.currentPaceSecPerKm,
        lastLocationAt: remoteLocation?.lastUpdatedAt ?? participant.lastLocationAt,
        status: normalizeParticipantStatus(remoteStatus?.status ?? remoteLocation?.state) ?? participant.status,
      };
    });
  }, [
    participants,
    tracker.averagePaceSecPerKm,
    tracker.currentPaceSecPerKm,
    tracker.distanceMeters,
    tracker.elapsedSeconds,
    tracker.isTracking,
    tracker.participantStatuses,
    tracker.remoteLocations,
    userId,
  ]);
  const leaderGapLabel = useMemo(() => {
    const sorted = [...participantRows].sort((a, b) => b.totalDistanceMeters - a.totalDistanceMeters);
    const leader = sorted[0];
    const you = participantRows.find((participant) => participant.userId === userId);
    if (!leader || !you || leader.userId === userId) {
      return "Leading";
    }
    const gapMeters = Math.max(0, leader.totalDistanceMeters - you.totalDistanceMeters);
    return `-${(gapMeters / 1000).toFixed(2)} km`;
  }, [participantRows, userId]);
  const cheerTarget = useMemo(
    () =>
      participantRows
        .filter((participant) => participant.userId !== userId)
        .sort((a, b) => b.totalDistanceMeters - a.totalDistanceMeters)[0],
    [participantRows, userId],
  );
  const remoteMapParticipants = useMemo(
    () =>
      participantRows
        .filter((participant) => participant.userId !== userId)
        .map((participant) => {
          const remote = tracker.remoteLocations[participant.userId];
          const current: LatLng | undefined = remote
            ? {
                latitude: remote.latitude,
                longitude: remote.longitude,
              }
            : undefined;
          return {
            current,
            participant,
            route: remoteDisplayRoutes[participant.userId] ?? [],
          };
        }),
    [participantRows, remoteDisplayRoutes, tracker.remoteLocations, userId],
  );
  const primaryRemoteMapParticipant = useMemo(
    () => remoteMapParticipants.find((item) => item.current) ?? remoteMapParticipants[0],
    [remoteMapParticipants],
  );
  const isLongDistanceGroup = useMemo(() => {
    if (!currentPoint) {
      return false;
    }
    return remoteMapParticipants.some(
      (item) => item.current && calculateDistanceMeters(currentPoint, item.current) >= LONG_DISTANCE_GROUP_THRESHOLD_METERS,
    );
  }, [currentPoint, remoteMapParticipants]);
  const overviewPins = useMemo<MapPin[]>(
    () =>
      remoteMapParticipants
        .filter((item): item is typeof item & { current: LatLng } => Boolean(item.current))
        .map((item) => ({
          id: item.participant.userId,
          coordinate: item.current,
          label: item.participant.nickname,
        })),
    [remoteMapParticipants],
  );
  const localProgressRatio = tracker.distanceMeters / 5000;
  const primaryRemoteProgressRatio = (primaryRemoteMapParticipant?.participant.totalDistanceMeters ?? 0) / 5000;
  const latestCheerLabel = useMemo(() => {
    if (!tracker.latestCheer) {
      return undefined;
    }
    const sender = participantRows.find((participant) => participant.userId === tracker.latestCheer?.fromUserId);
    return `Cheer from ${sender?.nickname ?? "friend"} - ${formatCheerCode(tracker.latestCheer.cheerCode)}`;
  }, [participantRows, tracker.latestCheer]);
  const totalCheers = tracker.sentCheers + tracker.receivedCheers.length;
  const useKoreanVoice = !speechLanguage || speechLanguage.toLowerCase().startsWith("ko");
  const speakVoice = useCallback(
    async (text: string, reason: string) => {
      if (!voiceFeedbackEnabled) {
        setVoiceStatus("Voice feedback off");
        return;
      }
      try {
        await Speech.stop();
        setVoiceStatus(`Voice queued: ${reason}`);
        Speech.speak(text, {
          language: speechLanguage,
          pitch: 1,
          rate: 0.95,
          onStart: () => setVoiceStatus(`Speaking: ${reason}`),
          onDone: () => setVoiceStatus(`Voice done: ${reason}`),
          onError: (error) => setVoiceStatus(`Voice error: ${error.message}`),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown speech error";
        setVoiceStatus(`Voice error: ${message}`);
      }
    },
    [speechLanguage, voiceFeedbackEnabled],
  );

  useEffect(() => {
    void tracker.start();
  }, [tracker.start]);

  useEffect(() => {
    if (Platform.OS === "android") {
      ToastAndroid.show("Screen stays awake during this run and may use more battery.", ToastAndroid.LONG);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function loadParticipants() {
      try {
        const response = await authenticatedGet<RunningSessionResponseDto>(`/running-sessions/${sessionId}`);
        if (isMounted) {
          setParticipants(response.participantSummaries ?? []);
          setVoiceFeedbackEnabled(response.session.voiceFeedbackEnabled);
        }
      } catch {
        if (isMounted) {
          setParticipants([]);
        }
      }
    }
    void loadParticipants();
    timer = setInterval(() => {
      void loadParticipants();
    }, 3000);
    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [authenticatedGet, sessionId]);

  useEffect(() => {
    if (!currentRoutePoint) {
      return;
    }
    setRoute((current) => {
      const previous = current[current.length - 1];
      if (
        previous?.latitude === currentRoutePoint.latitude &&
        previous.longitude === currentRoutePoint.longitude &&
        previous.recordedAt === currentRoutePoint.recordedAt
      ) {
        return current;
      }
      return filterDisplayRoutePoints([...current, currentRoutePoint].slice(-MAX_ROUTE_POINTS));
    });
  }, [currentRoutePoint]);

  useEffect(() => {
    const remotes = Object.values(tracker.remoteLocations);
    if (!remotes.length) {
      return;
    }
    setRemoteRoutes((current) => {
      let next = current;
      for (const remote of remotes) {
        const point: GeoPoint = {
          latitude: remote.latitude,
          longitude: remote.longitude,
          accuracyMeters: remote.accuracyMeters,
          recordedAt: remote.lastUpdatedAt,
        };
        const existing = current[remote.userId] ?? [];
        const previous = existing[existing.length - 1];
        if (
          previous?.latitude === point.latitude &&
          previous.longitude === point.longitude &&
          previous.recordedAt === point.recordedAt
        ) {
          continue;
        }
        const filtered = filterDisplayRoutePoints([...existing, point].slice(-MAX_ROUTE_POINTS));
        next = {
          ...next,
          [remote.userId]: filtered,
        };
      }
      return next;
    });
  }, [tracker.remoteLocations]);

  useEffect(() => {
    let isMounted = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!isMounted) {
          return;
        }
        const preferredVoice =
          voices.find((voice) => voice.language.toLowerCase().startsWith("ko")) ??
          voices.find((voice) => voice.language.toLowerCase().startsWith("en"));
        setSpeechLanguage(preferredVoice?.language);
        setVoiceStatus(preferredVoice ? `Voice ready: ${preferredVoice.language}` : "Voice ready: default");
      })
      .catch((error) => {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "Speech engine unavailable";
          setVoiceStatus(`Voice setup error: ${message}`);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (!voiceFeedbackEnabled || !tracker.isTracking || hasSpokenStart) {
      return;
    }
    setHasSpokenStart(true);
    void speakVoice(
      useKoreanVoice ? "러닝을 시작합니다. 실시간 공유가 켜져 있습니다." : "Run started. Live sharing is on.",
      "run start",
    );
  }, [hasSpokenStart, speakVoice, tracker.isTracking, useKoreanVoice, voiceFeedbackEnabled]);

  useEffect(() => {
    if (!voiceFeedbackEnabled || !tracker.isTracking || tracker.distanceMeters < nextVoiceMilestoneMeters) {
      return;
    }
    const milestoneKilometers = nextVoiceMilestoneMeters / 1000;
    void speakVoice(
      useKoreanVoice
        ? `${milestoneKilometers.toFixed(1)} 킬로미터 완료. 평균 페이스는 킬로미터당 ${formatPace(
            tracker.averagePaceSecPerKm,
          )} 입니다.`
        : `${milestoneKilometers.toFixed(1)} kilometers completed. Average pace ${formatPace(
            tracker.averagePaceSecPerKm,
          )} per kilometer.`,
      `${milestoneKilometers.toFixed(1)} km`,
    );
    setNextVoiceMilestoneMeters((value) => value + 500);
  }, [
    nextVoiceMilestoneMeters,
    speakVoice,
    tracker.averagePaceSecPerKm,
    tracker.distanceMeters,
    tracker.isTracking,
    useKoreanVoice,
    voiceFeedbackEnabled,
  ]);

  useEffect(() => {
    if (!voiceFeedbackEnabled || !tracker.latestCheer || tracker.latestCheer.id === spokenCheerId) {
      return;
    }
    const sender = participantRows.find((participant) => participant.userId === tracker.latestCheer?.fromUserId);
    setSpokenCheerId(tracker.latestCheer.id);
    void speakVoice(
      useKoreanVoice
        ? `${sender?.nickname ?? "친구"}에게서 응원이 도착했습니다. ${formatCheerCodeKorean(
            tracker.latestCheer.cheerCode,
          )}.`
        : `Cheer from ${sender?.nickname ?? "friend"}. ${formatCheerCode(tracker.latestCheer.cheerCode)}.`,
      "cheer received",
    );
  }, [participantRows, speakVoice, spokenCheerId, tracker.latestCheer, useKoreanVoice, voiceFeedbackEnabled]);

  async function finishRun() {
    setIsFinishing(true);
    const localResult = buildRunResult({
      averagePaceSecPerKm: tracker.averagePaceSecPerKm,
      cheers: totalCheers,
      distanceMeters: tracker.distanceMeters,
      durationSeconds: tracker.elapsedSeconds,
      participantRows,
      saveStatus: "pending",
      sessionId,
      userId,
    });
    tracker.stop();
    try {
      const finished = await authenticatedPost<RunningSessionFinishResponseDto>(`/running-sessions/${sessionId}/finish`, {});
      onFinish(
        buildRunResult({
          averagePaceSecPerKm: tracker.averagePaceSecPerKm,
          cheers: totalCheers,
          distanceMeters: tracker.distanceMeters,
          durationSeconds: tracker.elapsedSeconds,
          participantRows: mergeFinishedParticipants(finished.participantSummaries, participantRows, userId, {
            averagePaceSecPerKm: tracker.averagePaceSecPerKm,
            distanceMeters: tracker.distanceMeters,
            movingTimeSeconds: tracker.elapsedSeconds,
          }),
          saveStatus: "saved",
          sessionId,
          userId,
        }),
      );
    } catch (error) {
      const message = getFinishErrorMessage(error);
      const pendingResultId = `${sessionId}-${Date.now()}`;
      const pendingResult: RunResultSummary = {
        ...localResult,
        pendingResultId,
        saveError: message,
        saveStatus: "pending",
      };
      try {
        await savePendingRunResult({
          id: pendingResultId,
          userId,
          sessionId,
          result: pendingResult,
          createdAt: new Date().toISOString(),
          autoRetryDisabled: false,
          lastError: message,
          retryCount: 0,
        });
      } catch {
        // The result screen still keeps the local summary for the current app session.
      }
      onFinish(pendingResult);
    } finally {
      setIsFinishing(false);
    }
  }

  function sendCheer() {
    if (!cheerTarget) {
      setCheerStatus("No friend is in this run yet.");
      return;
    }
    const sent = tracker.sendCheer(cheerTarget.userId, "nice");
    if (sent) {
      setCheerStatus(`Cheer sent to ${cheerTarget.nickname}`);
      setHasFailedCheer(false);
    } else {
      setHasFailedCheer(true);
      setCheerStatus("Cheer was not sent. Live sync is reconnecting, so try again in a moment.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isLongDistanceGroup ? (
        <View style={styles.mapPanel}>
          <View style={styles.mapPanelHeader}>
            <View>
              <Text style={styles.mapPanelTitle}>Together View</Text>
              <Text style={styles.mapPanelSubTitle}>
                {primaryRemoteMapParticipant?.current && currentPoint
                  ? `${(calculateDistanceMeters(currentPoint, primaryRemoteMapParticipant.current) / 1000).toFixed(
                      0,
                    )} km apart - ${elapsedLabel}`
                  : `Shared timer - ${elapsedLabel}`}
              </Text>
            </View>
          </View>
          <View style={styles.mapModeTabs}>
            <MapModeButton active={mapMode === "together"} label="Together" onPress={() => setMapMode("together")} />
            <MapModeButton active={mapMode === "overview"} label="Overview" onPress={() => setMapMode("overview")} />
            <MapModeButton active={mapMode === "mine"} label="My Map" onPress={() => setMapMode("mine")} />
          </View>
          {mapMode === "together" ? (
            <View style={styles.runnerCards}>
              <RunnerMapCard
                currentPoint={currentPoint}
                distanceMeters={tracker.distanceMeters}
                label="You"
                paceSecPerKm={tracker.averagePaceSecPerKm}
                progressRatio={localProgressRatio}
                route={displayRoute}
                statusText={mapStatus}
                trackingStatusText={distanceTrackingLabel}
              />
              {primaryRemoteMapParticipant ? (
                <RunnerMapCard
                  currentPoint={primaryRemoteMapParticipant.current}
                  distanceMeters={primaryRemoteMapParticipant.participant.totalDistanceMeters}
                  label={primaryRemoteMapParticipant.participant.nickname}
                  paceSecPerKm={primaryRemoteMapParticipant.participant.averagePaceSecPerKm}
                  progressRatio={primaryRemoteProgressRatio}
                  route={primaryRemoteMapParticipant.route}
                  statusText={
                    primaryRemoteMapParticipant.current
                      ? `Last seen ${primaryRemoteMapParticipant.participant.lastLocationAt?.slice(11, 19) ?? "now"}`
                      : "Waiting for friend GPS"
                  }
                  trackingStatusText="Friend route uses accepted live points"
                />
              ) : null}
            </View>
          ) : mapMode === "overview" ? (
            <LiveRunMap
              currentPoint={currentPoint}
              mode="overview"
              pins={overviewPins}
              route={[]}
              showRoute={false}
              statusText="Overview only"
              title="Group Overview"
              trackingStatusText="Detailed routes are unavailable in overview."
            />
          ) : (
            <LiveRunMap
              acceptedPointCount={tracker.acceptedPointCount}
              currentPoint={currentPoint}
              rejectedPointCount={tracker.rejectedPointCount}
              route={displayRoute}
              statusText={mapStatus}
              title="My Route"
              trackingStatusText={distanceTrackingLabel}
            />
          )}
        </View>
      ) : (
        <LiveRunMap
          acceptedPointCount={tracker.acceptedPointCount}
          currentPoint={currentPoint}
          rejectedPointCount={tracker.rejectedPointCount}
          route={displayRoute}
          statusText={mapStatus}
          trackingStatusText={distanceTrackingLabel}
        />
      )}

      {syncBanner ? (
        <View style={[styles.syncBanner, tracker.syncStatus === "offline" && styles.syncBannerOffline]}>
          <Text style={styles.syncBannerText}>{syncBanner}</Text>
        </View>
      ) : null}

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
        <MetricTile label="Leader Gap" value={leaderGapLabel} />
        <MetricTile label="Cheers" value={`${totalCheers}`} />
      </View>

      <View style={styles.friendPanel}>
        <Text style={styles.sectionTitle}>Group Status</Text>
        <Text style={styles.syncLine}>{syncStatusLabel}</Text>
        <Text style={styles.trackingLine}>{distanceTrackingLabel}</Text>
        <Text style={styles.syncDetail}>
          GPS accepted {tracker.acceptedPointCount} - rejected {tracker.rejectedPointCount}
        </Text>
        <Text style={styles.syncDetail}>
          Speed {tracker.speedMps === undefined ? "--" : tracker.speedMps.toFixed(1)} m/s - reconnects{" "}
          {tracker.reconnectAttempt}
        </Text>
        {tracker.syncMessage ? <Text style={styles.syncDetail}>{tracker.syncMessage}</Text> : null}
        {tracker.pendingLocationUpdates ? (
          <Text style={styles.syncDetail}>{tracker.pendingLocationUpdates} route points are waiting to sync.</Text>
        ) : null}
        {voiceFeedbackEnabled ? <Text style={styles.voiceLine}>{voiceStatus}</Text> : null}
        {latestCheerLabel ? <Text style={styles.cheerLine}>{latestCheerLabel}</Text> : null}
        {participantRows.map((participant) => (
          <Text key={participant.participantId} style={styles.friendLine}>
            {participant.nickname}
            {participant.isHost ? " (Host)" : ""} - {(participant.totalDistanceMeters / 1000).toFixed(2)} km -{" "}
            {formatPace(participant.averagePaceSecPerKm)}/km - {participant.status}
          </Text>
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          disabled={!cheerTarget}
          label={hasFailedCheer ? "Retry Cheer" : "Send Cheer"}
          variant="secondary"
          onPress={sendCheer}
        />
        <PrimaryButton
          disabled={!voiceFeedbackEnabled}
          label="Test Voice"
          variant="secondary"
          onPress={() => void speakVoice(useKoreanVoice ? "음성 안내 테스트입니다." : "Voice feedback test.", "test")}
        />
        <Text style={styles.cheerStatus}>{cheerStatus}</Text>
        <PrimaryButton label={isFinishing ? "Finishing..." : "Finish"} variant="danger" onPress={finishRun} />
      </View>
    </ScrollView>
  );
}

function MapModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.mapModeButton, active && styles.mapModeButtonActive]} onPress={onPress}>
      <Text style={[styles.mapModeButtonText, active && styles.mapModeButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RunnerMapCard({
  currentPoint,
  distanceMeters,
  label,
  paceSecPerKm,
  progressRatio,
  route,
  statusText,
  trackingStatusText,
}: {
  currentPoint?: LatLng;
  distanceMeters: number;
  label: string;
  paceSecPerKm?: number;
  progressRatio: number;
  route: LatLng[];
  statusText: string;
  trackingStatusText: string;
}) {
  const clampedProgress = Math.min(1, Math.max(0, progressRatio));
  return (
    <View style={styles.runnerCard}>
      <View style={styles.runnerCardHeader}>
        <View>
          <Text style={styles.runnerCardName}>{label}</Text>
          <Text style={styles.runnerCardStats}>
            {(distanceMeters / 1000).toFixed(2)} km - {formatPace(paceSecPerKm)}/km
          </Text>
        </View>
        <Text style={styles.runnerCardPercent}>{Math.round(clampedProgress * 100)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${clampedProgress * 100}%` }]} />
      </View>
      <LiveRunMap
        currentPoint={currentPoint}
        mode="mini"
        route={route}
        statusText={statusText}
        title={label}
        trackingStatusText={trackingStatusText}
      />
    </View>
  );
}

function buildRunResult({
  averagePaceSecPerKm,
  cheers,
  distanceMeters,
  durationSeconds,
  participantRows,
  saveStatus = "saved",
  sessionId,
  userId,
}: {
  averagePaceSecPerKm?: number;
  cheers: number;
  distanceMeters: number;
  durationSeconds: number;
  participantRows: SessionParticipantSummaryDto[];
  saveStatus?: RunResultSummary["saveStatus"];
  sessionId: string;
  userId: string;
}): RunResultSummary {
  return {
    averagePaceSecPerKm,
    cheers,
    distanceMeters,
    durationSeconds,
      participants: participantRows.map((participant) =>
      participant.userId === userId
        ? {
            ...participant,
            nickname: "You",
            totalDistanceMeters: distanceMeters,
            movingTimeSeconds: durationSeconds,
            averagePaceSecPerKm,
          }
        : participant,
    ),
    saveStatus,
    sessionId,
  };
}

function mergeFinishedParticipants(
  finishedParticipants: SessionParticipantSummaryDto[] | undefined,
  currentParticipants: SessionParticipantSummaryDto[],
  userId: string,
  local: { averagePaceSecPerKm?: number; distanceMeters: number; movingTimeSeconds: number },
): SessionParticipantSummaryDto[] {
  const source = finishedParticipants?.length ? finishedParticipants : currentParticipants;
  return source.map((participant) =>
    participant.userId === userId
      ? {
          ...participant,
          nickname: "You",
          totalDistanceMeters: local.distanceMeters,
          movingTimeSeconds: local.movingTimeSeconds,
          averagePaceSecPerKm: local.averagePaceSecPerKm,
        }
      : participant,
  );
}

function normalizeParticipantStatus(status?: string): SessionParticipantSummaryDto["status"] | undefined {
  if (!status) {
    return undefined;
  }
  if (status === "lost_signal") {
    return "running";
  }
  if (
    status === "invited" ||
    status === "joined" ||
    status === "ready" ||
    status === "running" ||
    status === "paused" ||
    status === "finished" ||
    status === "left"
  ) {
    return status;
  }
  return undefined;
}

function calculateDistanceMeters(from: LatLng, to: LatLng): number {
  const earthRadiusMeters = 6371000;
  const dLat = degreesToRadians(to.latitude - from.latitude);
  const dLng = degreesToRadians(to.longitude - from.longitude);
  const lat1 = degreesToRadians(from.latitude);
  const lat2 = degreesToRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatDistanceTrackingStatus(quality: string): string {
  if (quality === "normal") {
    return "Tracking normally";
  }
  if (quality === "weak_gps") {
    return "Weak GPS signal - distance paused";
  }
  if (quality === "too_fast") {
    return "Movement too fast for running - not counted";
  }
  return "Waiting for stable GPS";
}

function getFinishErrorMessage(error: unknown): string {
  const classified = classifyApiError(error, "The API was unavailable when finishing this run.");
  if (classified.kind === "network" || classified.kind === "timeout") {
    return `${classified.message} This result is kept on this phone.`;
  }
  if (!(error instanceof ApiError)) {
    return "The API was unavailable when finishing this run.";
  }
  if (error.status === 0) {
    return "Network connection failed while finishing. This result is kept on this phone.";
  }
  if (error.status === 401) {
    return "Sign-in expired while finishing. This result is kept on this phone.";
  }
  if (error.status >= 500) {
    return `${classified.message} This result is kept on this phone.`;
  }
  return error.message || "This result is kept on this phone until the API is available.";
}

function formatCheerCode(code: string): string {
  return code
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatCheerCodeKorean(code: string): string {
  if (code === "nice") {
    return "좋아요";
  }
  if (code === "keep_pace") {
    return "페이스를 유지해요";
  }
  if (code === "last_km") {
    return "마지막 1킬로미터입니다";
  }
  if (code === "push") {
    return "조금만 더 힘내요";
  }
  if (code === "almost_there") {
    return "거의 다 왔어요";
  }
  if (code === "great_finish") {
    return "멋진 완주입니다";
  }
  return "응원이 도착했습니다";
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  mapPanel: {
    gap: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  mapPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  mapPanelTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  mapPanelSubTitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  mapModeTabs: {
    flexDirection: "row",
    gap: 8,
  },
  mapModeButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  mapModeButtonActive: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
  },
  mapModeButtonText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "900",
  },
  mapModeButtonTextActive: {
    color: "#ffffff",
  },
  runnerCards: {
    gap: 12,
  },
  runnerCard: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  runnerCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  runnerCardName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  runnerCardStats: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  runnerCardPercent: {
    color: "#0f766e",
    fontSize: 15,
    fontWeight: "900",
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#dbeafe",
  },
  progressFill: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "#0f766e",
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
  syncBanner: {
    borderRadius: 8,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: 12,
  },
  syncBannerOffline: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecaca",
  },
  syncBannerText: {
    color: "#9a3412",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
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
  syncDetail: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  trackingLine: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "900",
  },
  cheerLine: {
    color: "#7c2d12",
    fontSize: 13,
    fontWeight: "900",
  },
  voiceLine: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
  },
  actions: {
    gap: 10,
  },
  cheerStatus: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
