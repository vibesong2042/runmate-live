import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { ENABLE_NATIVE_MAP } from "../config/runtime";

interface LatLng {
  latitude: number;
  longitude: number;
}

interface LiveRunMapProps {
  currentPoint?: LatLng;
  route: LatLng[];
  statusText: string;
  trackingStatusText?: string;
  acceptedPointCount?: number;
  rejectedPointCount?: number;
}

const DEFAULT_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const NativeMaps = loadNativeMaps();

function loadNativeMaps(): typeof import("react-native-maps") | undefined {
  if (!ENABLE_NATIVE_MAP) {
    return undefined;
  }
  try {
    return require("react-native-maps") as typeof import("react-native-maps");
  } catch {
    return undefined;
  }
}

export function LiveRunMap({
  currentPoint,
  route,
  statusText,
  trackingStatusText,
  acceptedPointCount = 0,
  rejectedPointCount = 0,
}: LiveRunMapProps) {
  if (!NativeMaps) {
    return (
      <LiveRunMapFallback
        acceptedPointCount={acceptedPointCount}
        currentPoint={currentPoint}
        rejectedPointCount={rejectedPointCount}
        route={route}
        statusText={statusText}
        trackingStatusText={trackingStatusText}
      />
    );
  }

  const MapView = NativeMaps.default;
  const Marker = NativeMaps.Marker;
  const Polyline = NativeMaps.Polyline;
  const provider = Platform.OS === "android" ? NativeMaps.PROVIDER_GOOGLE : undefined;
  const region = currentPoint
    ? {
        latitude: currentPoint.latitude,
        longitude: currentPoint.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : DEFAULT_REGION;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} provider={provider} region={region} showsUserLocation showsMyLocationButton>
        {route.length > 1 ? <Polyline coordinates={route} strokeColor="#0f766e" strokeWidth={5} /> : null}
        {currentPoint ? <Marker coordinate={currentPoint} title="You" /> : null}
      </MapView>
      <View style={styles.status}>
        <Text style={styles.statusText}>{statusText}</Text>
        {trackingStatusText ? <Text style={styles.statusSubText}>{trackingStatusText}</Text> : null}
      </View>
    </View>
  );
}

function LiveRunMapFallback({
  acceptedPointCount = 0,
  currentPoint,
  rejectedPointCount = 0,
  route,
  statusText,
  trackingStatusText,
}: LiveRunMapProps) {
  return (
    <View style={[styles.container, styles.fallbackContainer]}>
      <View style={styles.fallbackHeader}>
        <Text style={styles.fallbackTitle}>Live Tracking</Text>
        <Text style={styles.fallbackBadge}>Map off</Text>
      </View>
      <View style={styles.fallbackGrid}>
        <View style={styles.fallbackMetric}>
          <Text style={styles.fallbackLabel}>GPS</Text>
          <Text style={styles.fallbackValue}>{statusText}</Text>
        </View>
        <View style={styles.fallbackMetric}>
          <Text style={styles.fallbackLabel}>Route Points</Text>
          <Text style={styles.fallbackValue}>{route.length}</Text>
        </View>
      </View>
      <View style={styles.fallbackGrid}>
        <View style={styles.fallbackMetric}>
          <Text style={styles.fallbackLabel}>Accepted</Text>
          <Text style={styles.fallbackValue}>{acceptedPointCount}</Text>
        </View>
        <View style={styles.fallbackMetric}>
          <Text style={styles.fallbackLabel}>Rejected</Text>
          <Text style={styles.fallbackValue}>{rejectedPointCount}</Text>
        </View>
      </View>
      {trackingStatusText ? <Text style={styles.fallbackTracking}>{trackingStatusText}</Text> : null}
      <Text style={styles.fallbackCoordinates}>
        {currentPoint
          ? `${currentPoint.latitude.toFixed(5)}, ${currentPoint.longitude.toFixed(5)}`
          : "Waiting for location"}
      </Text>
      <Text style={styles.fallbackNote}>Native map is disabled for this beta build. Tracking and sharing still work.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 260,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#dbeafe",
  },
  map: {
    minHeight: 260,
  },
  fallbackContainer: {
    justifyContent: "space-between",
    padding: 16,
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fallbackTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
  },
  fallbackBadge: {
    borderRadius: 8,
    backgroundColor: "#0f766e",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fallbackGrid: {
    flexDirection: "row",
    gap: 10,
  },
  fallbackMetric: {
    flex: 1,
    gap: 4,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  fallbackLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  fallbackValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  fallbackCoordinates: {
    color: "#0f766e",
    fontSize: 18,
    fontWeight: "900",
  },
  fallbackNote: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  status: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  statusSubText: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },
  fallbackTracking: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "900",
  },
});
