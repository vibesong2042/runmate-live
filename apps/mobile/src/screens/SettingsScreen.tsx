import React, { useEffect, useState } from "react";
import * as Battery from "expo-battery";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  API_URL,
  ENABLE_NATIVE_MAP,
  NATIVE_MAP_API_KEY_CONFIGURED,
  RUNTIME_ENV,
  SENTRY_ENABLED,
  WS_URL,
} from "../config/runtime";
import { PrimaryButton } from "../components/PrimaryButton";
import { captureDiagnosticError } from "../monitoring/sentry";
import { loadLiveRunDiagnostics, type LiveRunDiagnostics } from "../storage/live-run-diagnostics";

interface SettingsScreenProps {
  authStatus?: {
    hasSession: boolean;
    runnerId?: string;
    isDemoMode: boolean;
  };
}

export function SettingsScreen({ authStatus }: SettingsScreenProps) {
  const [defaultShare, setDefaultShare] = useState(true);
  const [voice, setVoice] = useState(true);
  const [safety, setSafety] = useState(true);
  const [diagnostics, setDiagnostics] = useState<LiveRunDiagnostics>();
  const [sentryStatus, setSentryStatus] = useState(SENTRY_ENABLED ? "Sentry ready" : "Sentry disabled");
  const powerState = Battery.usePowerState();

  useEffect(() => {
    let isMounted = true;
    async function loadDiagnostics() {
      const loaded = await loadLiveRunDiagnostics();
      if (isMounted) {
        setDiagnostics(loaded);
      }
    }

    void loadDiagnostics();
    const timer = setInterval(() => {
      void loadDiagnostics();
    }, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.panel}>
        <SettingRow label="Default live location sharing" value={defaultShare} onValueChange={setDefaultShare} />
        <SettingRow label="Voice feedback" value={voice} onValueChange={setVoice} />
        <SettingRow label="Safety contact alerts" value={safety} onValueChange={setSafety} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Privacy</Text>
        <Text style={styles.body}>
          Detailed routes are private by default. Live location is visible only to invited session participants.
        </Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Beta Diagnostics</Text>
        <DiagnosticsRow label="Runtime" value={RUNTIME_ENV} />
        <DiagnosticsRow label="Runner" value={authStatus?.runnerId ?? "not signed in"} />
        <DiagnosticsRow label="API" value={API_URL} />
        <DiagnosticsRow label="WebSocket" value={WS_URL} />
        <DiagnosticsRow
          label="Map"
          value={`${ENABLE_NATIVE_MAP ? "native" : "fallback"} / key ${
            NATIVE_MAP_API_KEY_CONFIGURED ? "configured" : "missing"
          }`}
        />
        <DiagnosticsRow label="Battery" value={formatBatteryLevel(powerState.batteryLevel)} />
        <DiagnosticsRow label="Low Power" value={powerState.lowPowerMode ? "on" : "off"} />
        <DiagnosticsRow label="Live Sync" value={diagnostics?.syncStatus ?? "no run yet"} />
        <DiagnosticsRow label="Reconnects" value={`${diagnostics?.reconnectAttempt ?? 0}`} />
        <DiagnosticsRow label="Pending GPS" value={`${diagnostics?.pendingLocationUpdates ?? 0}`} />
        <DiagnosticsRow label="GPS Accuracy" value={formatMeters(diagnostics?.gpsAccuracyMeters)} />
        <DiagnosticsRow label="Speed" value={formatSpeed(diagnostics?.speedMps)} />
        <DiagnosticsRow label="Last Sync" value={formatDateTime(diagnostics?.lastSyncedAt)} />
        <DiagnosticsRow label="Sentry" value={sentryStatus} />
        <PrimaryButton
          label="Send Test Error"
          variant="secondary"
          onPress={() => setSentryStatus(captureDiagnosticError())}
        />
      </View>
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function DiagnosticsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.diagnosticsRow}>
      <Text style={styles.diagnosticsLabel}>{label}</Text>
      <Text style={styles.diagnosticsValue}>{value}</Text>
    </View>
  );
}

function formatBatteryLevel(value: number | null): string {
  if (value === null || value < 0) {
    return "unknown";
  }
  return `${Math.round(value * 100)}%`;
}

function formatMeters(value?: number): string {
  return value === undefined ? "--" : `${Math.round(value)} m`;
}

function formatSpeed(value?: number): string {
  return value === undefined ? "--" : `${value.toFixed(1)} m/s`;
}

function formatDateTime(value?: string): string {
  return value ? value.slice(11, 19) : "--";
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
  panel: {
    gap: 12,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  body: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
  },
  diagnosticsRow: {
    gap: 4,
  },
  diagnosticsLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  diagnosticsValue: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
  },
});
