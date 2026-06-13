import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ENABLE_NATIVE_MAP, NATIVE_MAP_API_KEY_CONFIGURED } from "../config/runtime";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapPin {
  id: string;
  coordinate: LatLng;
  label: string;
}

interface LiveRunMapProps {
  acceptedPointCount?: number;
  currentPoint?: LatLng;
  mapUnavailableText?: string;
  mode?: "detail" | "mini" | "overview";
  pins?: MapPin[];
  rejectedPointCount?: number;
  route: LatLng[];
  showRoute?: boolean;
  statusText: string;
  title?: string;
  trackingStatusText?: string;
}

type MapRegion = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapRef = {
  animateToRegion?: (region: MapRegion, duration?: number) => void;
};

const DEFAULT_REGION: MapRegion = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const FOLLOW_ANIMATION_THROTTLE_MS = 5000;
const NativeMaps = loadNativeMaps();

function loadNativeMaps(): typeof import("react-native-maps") | undefined {
  if (!ENABLE_NATIVE_MAP || !NATIVE_MAP_API_KEY_CONFIGURED) {
    return undefined;
  }
  try {
    return require("react-native-maps") as typeof import("react-native-maps");
  } catch {
    return undefined;
  }
}

export function LiveRunMap({
  acceptedPointCount = 0,
  currentPoint,
  mapUnavailableText,
  mode = "detail",
  pins = [],
  rejectedPointCount = 0,
  route,
  showRoute = true,
  statusText,
  title,
  trackingStatusText,
}: LiveRunMapProps) {
  const [isFollowing, setIsFollowing] = useState(true);
  const mapRef = useRef<MapRef | null>(null);
  const lastAnimatedAtRef = useRef(0);
  const effectiveRoute = showRoute ? route : [];
  const markerPins = useMemo(() => {
    const basePins = currentPoint ? [{ id: "you", coordinate: currentPoint, label: "You" }, ...pins] : pins;
    const seen = new Set<string>();
    return basePins.filter((pin) => {
      if (seen.has(pin.id)) {
        return false;
      }
      seen.add(pin.id);
      return true;
    });
  }, [currentPoint, pins]);
  const region = useMemo(
    () => buildRegion({ currentPoint, mode, pins: markerPins, route: effectiveRoute }),
    [currentPoint, effectiveRoute, markerPins, mode],
  );

  useEffect(() => {
    if (!NativeMaps || !isFollowing || !mapRef.current?.animateToRegion) {
      return;
    }
    const now = Date.now();
    if (now - lastAnimatedAtRef.current < FOLLOW_ANIMATION_THROTTLE_MS) {
      return;
    }
    lastAnimatedAtRef.current = now;
    mapRef.current.animateToRegion(region, 650);
  }, [isFollowing, region]);

  if (!NativeMaps) {
    return (
      <LiveRunMapFallback
        acceptedPointCount={acceptedPointCount}
        currentPoint={currentPoint}
        mapUnavailableText={mapUnavailableText}
        rejectedPointCount={rejectedPointCount}
        route={effectiveRoute}
        statusText={statusText}
        title={title}
        trackingStatusText={trackingStatusText}
      />
    );
  }

  const MapView = NativeMaps.default;
  const Marker = NativeMaps.Marker;
  const Polyline = NativeMaps.Polyline;
  const provider = Platform.OS === "android" ? NativeMaps.PROVIDER_GOOGLE : undefined;

  return (
    <View style={[styles.container, mode === "mini" && styles.miniContainer]}>
      <MapView
        ref={(ref: MapRef | null) => {
          mapRef.current = ref;
        }}
        style={[styles.map, mode === "mini" && styles.miniMap]}
        provider={provider}
        initialRegion={region}
        showsUserLocation={mode !== "overview"}
        showsMyLocationButton={mode !== "mini"}
        onPanDrag={() => setIsFollowing(false)}
      >
        {effectiveRoute.length > 1 ? <Polyline coordinates={effectiveRoute} strokeColor="#0f766e" strokeWidth={5} /> : null}
        {markerPins.map((pin) => (
          <Marker key={pin.id} coordinate={pin.coordinate} title={pin.label} />
        ))}
      </MapView>
      {title ? (
        <View style={styles.titleBadge}>
          <Text style={styles.titleBadgeText}>{title}</Text>
        </View>
      ) : null}
      {!isFollowing && mode !== "overview" ? (
        <Pressable style={styles.followButton} onPress={() => setIsFollowing(true)}>
          <Text style={styles.followButtonText}>Follow</Text>
        </Pressable>
      ) : null}
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
  mapUnavailableText,
  rejectedPointCount = 0,
  route,
  statusText,
  title,
  trackingStatusText,
}: LiveRunMapProps) {
  return (
    <View style={[styles.container, styles.fallbackContainer]}>
      <View style={styles.fallbackHeader}>
        <Text style={styles.fallbackTitle}>{title ?? "Live Tracking"}</Text>
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
      <Text style={styles.fallbackNote}>
        {mapUnavailableText ??
          "Native map is disabled or missing a Google Maps API key. Tracking and sharing still work."}
      </Text>
    </View>
  );
}

function buildRegion({
  currentPoint,
  mode,
  pins,
  route,
}: {
  currentPoint?: LatLng;
  mode: NonNullable<LiveRunMapProps["mode"]>;
  pins: MapPin[];
  route: LatLng[];
}): MapRegion {
  const points = [...route, ...pins.map((pin) => pin.coordinate)];
  if (currentPoint) {
    points.push(currentPoint);
  }
  if (!points.length) {
    return DEFAULT_REGION;
  }
  if (mode !== "overview" || points.length === 1) {
    const anchor = currentPoint ?? points[points.length - 1];
    return {
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      latitudeDelta: mode === "mini" ? 0.008 : 0.012,
      longitudeDelta: mode === "mini" ? 0.008 : 0.012,
    };
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.08, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.08, (maxLng - minLng) * 1.8),
  };
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
  miniContainer: {
    minHeight: 160,
  },
  map: {
    minHeight: 260,
  },
  miniMap: {
    minHeight: 160,
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
  fallbackTracking: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "900",
  },
  followButton: {
    position: "absolute",
    right: 10,
    top: 10,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  followButtonText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "900",
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
  titleBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  titleBadgeText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "900",
  },
});
