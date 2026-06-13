# RunMate Live

Remote live running app MVP.

## What is implemented

- Monorepo layout for mobile, API, and shared domain code
- Shared TypeScript models for users, friendships, running sessions, live locations, activities, challenges, and achievements
- Pure running calculation utilities for distance, pace, GPS noise filtering, and progress comparison
- API server skeleton with REST endpoints, HMAC-signed development JWTs, privacy consent endpoints, and WebSocket event contracts
- API app factory and integration test for login, session creation, location upload, finish, and activity creation
- Expo React Native screen skeletons for onboarding, home, friends, run setup, live run, result, profile, and settings
- Expo foreground GPS tracking hook wired into the live running screen
- Mobile auth flow obtains a development JWT, then uses Bearer auth for session creation, run start, run finish, and WebSocket live tracking
- Live run screen tracks route, pace, and live sync; native maps can be enabled with `EXPO_PUBLIC_ENABLE_NATIVE_MAP=true`
- Running distance uses accepted GPS anchors, excludes weak GPS and vehicle-speed jumps, and shows tracking diagnostics in the live screen
- Live run screen keeps the device awake during active tests, buffers unsynced GPS updates locally, and exposes beta diagnostics in Settings
- Android preview builds support a fallback map profile and a Google Maps profile when `ANDROID_GOOGLE_MAPS_API_KEY` is provided
- PostgreSQL schema migration for the MVP domain

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop for PostgreSQL/PostGIS and Redis

PowerShell may block `npm.ps1`. Use `npm.cmd` in that case.

## Setup

```bash
npm install
docker compose up -d
cp .env.example .env
psql "postgres://runmate:runmate@localhost:5432/runmate" -f db/migrations/001_init.sql
```

Or use the migration runner:

```bash
npm.cmd run db:migrate
```

## Development

```bash
npm.cmd run dev:api
npm.cmd run dev:mobile
```

For a phone on the same Wi-Fi, use:

```bash
npm.cmd run dev:mobile:lan
```

For friends testing from another Wi-Fi or mobile data, use Expo tunnel mode and a public API/WSS URL:

```bash
npm.cmd run dev:mobile:tunnel
```

See [docs/EXTERNAL_BETA_TESTING.md](docs/EXTERNAL_BETA_TESTING.md) for the full outside-network test checklist.

## Mobile Map Check

The live run screen can use `react-native-maps` when `EXPO_PUBLIC_ENABLE_NATIVE_MAP=true`. Preview beta builds keep native maps off by default so live tracking can be tested safely before an Android Google Maps API key is configured.

RunMate is a running tracker, not a general vehicle movement tracker. GPS points with weak accuracy, very small drift, stale timestamps, or movement faster than the configured running threshold are not counted toward distance. During a live run, the app shows whether distance is tracking normally, paused because of weak GPS, or excluded because movement is too fast for running.

Use `eas build --profile preview --platform android` for the safe fallback map APK. Use `eas build --profile preview-map --platform android` only after setting `ANDROID_GOOGLE_MAPS_API_KEY` for the Android package `com.papasong.runmatelive`.

The `preview-map` profile requires a Google Cloud key with Maps SDK for Android enabled. Register both the preview keystore SHA-1 and production keystore SHA-1 when they differ, restrict the key to package `com.papasong.runmatelive`, and expose it to EAS as `ANDROID_GOOGLE_MAPS_API_KEY`. The key must not be committed to this repository. If the key is missing, RunMate falls back to the live tracking panel instead of crashing.

For a real group running test:

1. Start the API with `npm.cmd run dev:api`.
2. Start Expo with `npm.cmd run dev:mobile`.
3. Open the app on a phone.
4. Allow location permission.
5. Start a run and check that the marker and route line update.

## Verification

```bash
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test
```

The API server exposes:

- `GET /health`
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /privacy/location-consent`
- `GET /privacy/consents`
- `POST /running-sessions`
- `POST /running-sessions/:sessionId/locations`
- `GET /running-sessions/:sessionId/locations/latest`
- `WS /ws?userId=00000000-0000-4000-8000-000000000001&sessionId=demo-session`

Set `STORE_DRIVER=postgres` to use PostgreSQL instead of the default in-memory development store.
Set `REQUIRE_AUTH=true` to reject REST and WebSocket requests that do not include a valid access token.

## MVP build order

1. Auth and consent
2. Friends and invites
3. Running sessions
4. Location tracking and pace calculation
5. WebSocket live sharing
6. Live running screen
7. Results and activity history
