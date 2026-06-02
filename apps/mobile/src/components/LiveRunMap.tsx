import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type LatLng } from "react-native-maps";

interface LiveRunMapProps {
  currentPoint?: LatLng;
  route: LatLng[];
  statusText: string;
}

const DEFAULT_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export function LiveRunMap({ currentPoint, route, statusText }: LiveRunMapProps) {
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
      <MapView style={styles.map} region={region} showsUserLocation showsMyLocationButton>
        {route.length > 1 ? <Polyline coordinates={route} strokeColor="#0f766e" strokeWidth={5} /> : null}
        {currentPoint ? <Marker coordinate={currentPoint} title="You" /> : null}
      </MapView>
      <View style={styles.status}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
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
});
