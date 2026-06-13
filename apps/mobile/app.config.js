const androidGoogleMapsApiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY ?? "";
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

module.exports = {
  expo: {
    name: "RunMate Live",
    owner: "papasong",
    slug: "runmate-live",
    version: "0.1.0",
    orientation: "portrait",
    scheme: "runmate",
    userInterfaceStyle: "light",
    ios: {
      supportsTablet: false,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "RunMate uses your location during runs to record route, distance, pace, and live sharing with invited friends.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "RunMate needs background location access only when you choose to keep recording a run while the screen is off.",
      },
    },
    android: {
      package: "com.papasong.runmatelive",
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION"],
      config: {
        googleMaps: {
          apiKey: androidGoogleMapsApiKey,
        },
      },
    },
    plugins: ["expo-asset", ...(sentryDsn ? ["@sentry/react-native"] : [])],
    extra: {
      nativeMapApiKeyConfigured: Boolean(androidGoogleMapsApiKey.trim()),
      sentryConfigured: Boolean(sentryDsn),
      eas: {
        projectId: "8c420a52-8c31-4f6b-8865-cfe74d6dd970",
      },
    },
  },
};
