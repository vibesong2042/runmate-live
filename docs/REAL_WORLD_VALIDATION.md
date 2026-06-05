# RunMate Live real-world validation strategy

This document defines what must be ready before testing RunMate Live with friends in real conditions, not just a temporary development tunnel.

## Recommended target

Use this setup for real-world beta validation:

1. Cloud-hosted API with a stable HTTPS URL.
2. PostgreSQL database attached to the API.
3. WebSocket available through the same public API host at `/ws`.
4. Android internal preview APK built with EAS Build.
5. Mobile app configured with the stable API and WSS URLs before building.

Do not use these as the primary real-world validation setup:

- LAN IPs such as `192.168.x.x`.
- Cloudflare quick tunnel URLs from `trycloudflare.com`.
- Expo Go packager URLs from `exp.direct`.
- In-memory API storage.
- A development PC that can sleep or restart without supervision.

Quick tunnels and Expo Go are useful for same-day checks. They are not stable enough for repeated field validation because URLs can change and the app depends on a running development server.

## Option A: cloud beta server, preferred

Choose this when the goal is to test with friends repeatedly over several days.

You need:

- A cloud account that can run a Node.js service with WebSocket support.
- A PostgreSQL database.
- A stable public API URL, for example `https://api-preview.example.com`.
- Environment variables on the API service:

```text
RUNMATE_ENV=preview
API_HOST=0.0.0.0
API_PORT=4000
STORE_DRIVER=postgres
REQUIRE_AUTH=true
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
JWT_ACCESS_SECRET=<long random value>
JWT_REFRESH_SECRET=<different long random value>
CORS_ORIGIN=*
```

Build command:

```powershell
npm ci
npm run build
```

Migration command:

```powershell
npm.cmd run db:migrate
```

Start command:

```powershell
npm --workspace @runmate/api run start
```

After deployment, verify the API from this workspace:

```powershell
npm.cmd run check:beta-api -- https://YOUR_PUBLIC_API_HOST
```

The check must pass `health`, `login`, `session`, and `websocket`.

## Option B: idle server PC, acceptable fallback

Choose this only when a cloud host is not available yet and you can keep one Windows PC running as a server.

You need:

- A dedicated PC that stays on during the whole test window.
- Sleep and hibernation disabled.
- Stable internet, preferably wired Ethernet.
- Node.js 20 or newer.
- PostgreSQL installed as a Windows service.
- Cloudflare account with a named tunnel and stable public hostname, or an equivalent stable tunnel provider.
- API process running as a service or supervised process, not a normal terminal window.
- Automatic restart after reboot.
- Log files and database backup routine.

Minimum self-hosted topology:

```text
Phone app
  -> https://stable-public-api-host
  -> Cloudflare named tunnel
  -> idle server PC
  -> RunMate API on localhost:4000
  -> local PostgreSQL service
```

Do not use account-less quick tunnels for this option. A stable hostname is required so the APK does not need a new API URL every time the PC restarts.

## Mobile preview build

Use Expo Go only for development checks. For real-world validation, create an installable Android preview build.

Before building, set:

```text
EXPO_PUBLIC_RUNTIME_ENV=preview
EXPO_PUBLIC_API_URL=https://YOUR_PUBLIC_API_HOST
EXPO_PUBLIC_WS_URL=wss://YOUR_PUBLIC_API_HOST/ws
EXPO_PUBLIC_ENABLE_DEMO_FALLBACK=false
```

Then build:

```powershell
eas build --profile preview --platform android
```

The preview APK should be shared with testers. They should not need to type an `exp://` URL.

## Go/no-go checklist

Start field validation only when all items pass:

- `https://YOUR_PUBLIC_API_HOST/health` opens on mobile data.
- `npm.cmd run check:beta-api -- https://YOUR_PUBLIC_API_HOST` passes.
- The API reports `runtimeEnv=preview` and `storeDriver=postgres`.
- Two different Runner IDs can sign in.
- Friend add or invite flow works.
- One phone can create a group run and the other can join.
- Live screen shows connected sync on both phones.
- Send Cheer appears on the other phone and voice feedback plays.
- Finish saves the result.
- Restarting the app still shows saved activity history.
- Restarting the API does not delete users, friends, sessions, or activities.

## User-owned prerequisites

The user must provide or approve:

- Cloud provider account or always-on server PC.
- PostgreSQL database credentials.
- Stable public API hostname.
- Expo account for EAS Build.
- Permission to install preview APK on tester Android phones.
- Testers' availability window.

Codex can handle:

- Environment file changes.
- API deployment configuration guidance.
- Build and verification commands.
- API/WebSocket health checks.
- Test checklist and issue triage.

## Decision

Default path: cloud beta server plus EAS Android preview build.

Use idle server PC only as a short fallback if cloud setup is delayed. It reduces hosting cost, but it increases operational risk because power, sleep mode, Windows updates, home internet, local PostgreSQL, and tunnel supervision all become the user's responsibility.
