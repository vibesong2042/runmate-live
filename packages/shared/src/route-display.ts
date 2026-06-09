import { assessLocationForRunning, type GeoPoint } from "./running-metrics.js";

const DEFAULT_MAX_DISPLAY_ACCURACY_METERS = 20;
const DEFAULT_SMOOTHING_WINDOW = 3;

export interface DisplayRouteOptions {
  maxAccuracyMeters?: number;
}

export function filterDisplayRoutePoints(points: GeoPoint[], options: DisplayRouteOptions = {}): GeoPoint[] {
  const maxAccuracyMeters = options.maxAccuracyMeters ?? DEFAULT_MAX_DISPLAY_ACCURACY_METERS;
  const accepted: GeoPoint[] = [];

  for (const point of points) {
    if (point.accuracyMeters !== undefined && point.accuracyMeters > maxAccuracyMeters) {
      continue;
    }

    const previous = accepted[accepted.length - 1];
    const assessment = assessLocationForRunning(previous, point);
    if (assessment.accepted) {
      accepted.push(point);
    } else if (assessment.shouldResetAnchor) {
      accepted.push(point);
    }
  }

  return accepted;
}

export function smoothDisplayRoutePoints(points: GeoPoint[], windowSize = DEFAULT_SMOOTHING_WINDOW): GeoPoint[] {
  const safeWindowSize = Math.max(1, Math.floor(windowSize));
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - safeWindowSize + 1), index + 1);
    const latitude = window.reduce((total, item) => total + item.latitude, 0) / window.length;
    const longitude = window.reduce((total, item) => total + item.longitude, 0) / window.length;
    return {
      ...point,
      latitude,
      longitude,
    };
  });
}
