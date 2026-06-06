# RunMate Live external beta testing

This guide explains how to test RunMate Live with friends who are not on the same Wi-Fi.

## Why the previous setup failed

`http://192.168.219.116:4000` is a private LAN address. It works only for devices on the same router. A friend on mobile data or another Wi-Fi cannot reach it.

Use this rule:

- Same Wi-Fi test: `http://YOUR_COMPUTER_LAN_IP:4000` and `ws://YOUR_COMPUTER_LAN_IP:4000/ws`
- Outside-network test: `https://YOUR_PUBLIC_API_HOST` and `wss://YOUR_PUBLIC_API_HOST/ws`

Expo also has the same split. LAN mode is fast but same-network only. Tunnel mode is slower but reachable from other networks.

## Option A: quick outside test from this PC

Use this when you want to test with a friend today and can keep this PC turned on.

1. Start the API on this PC.

   ```powershell
   npm.cmd run dev:api
   ```

2. Expose the API with a tunnel service such as Cloudflare Tunnel or ngrok.

   The tunnel must forward to:

   ```text
   http://127.0.0.1:4000
   ```

   The tunnel should give you a public HTTPS URL like:

   ```text
   https://example-public-host.trycloudflare.com
   ```

3. Copy the mobile external environment example.

   ```powershell
   Copy-Item apps\mobile\.env.external.example apps\mobile\.env
   ```

4. Edit `apps/mobile/.env`.

   ```text
   EXPO_PUBLIC_RUNTIME_ENV=preview
   EXPO_PUBLIC_API_URL=https://example-public-host.trycloudflare.com
   EXPO_PUBLIC_WS_URL=wss://example-public-host.trycloudflare.com/ws
   EXPO_PUBLIC_ENABLE_DEMO_FALLBACK=false
   ```

5. Start Expo in tunnel mode.

   ```powershell
   npm.cmd run dev:mobile:tunnel
   ```

6. Send the Expo tunnel QR/link to your friend.

   For Expo Go, prefer Expo's own tunnel URL. It usually looks like:

   ```text
   exp://YOUR_EXPO_HOST.exp.direct
   ```

   Do not put Expo's Metro packager behind a generic HTTPS tunnel unless you have verified the manifest and bundle on the target device. Expo Go may try to reach the packager as `http://HOST:443`, which fails against HTTPS-only tunnels.

Expected result:

- The onboarding screen shows `API target: https://... (public test API)`.
- Both phones can sign in from different networks.
- Group run live sync says `Live sync: connected`.

Limitations:

- This PC must stay awake.
- The tunnel URL can change when restarted.
- Live reload and maps may feel slower than LAN mode.

## Option B: stable beta server

Use this when you want repeated tests without keeping this PC as the server.

1. Create a Node.js API service on a cloud host that supports WebSocket.
2. Create a PostgreSQL database for the API.
3. Set the API service environment variables:

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

4. Run migrations against the preview database.

   ```powershell
   npm.cmd run db:migrate
   ```

5. Confirm health from a phone on mobile data:

   ```text
   https://YOUR_PUBLIC_API_HOST/health
   ```

   Expected response:

   ```json
   { "ok": true, "runtimeEnv": "preview", "storeDriver": "postgres" }
   ```

6. Configure the mobile app to use the public API:

   ```text
   EXPO_PUBLIC_RUNTIME_ENV=preview
   EXPO_PUBLIC_API_URL=https://YOUR_PUBLIC_API_HOST
   EXPO_PUBLIC_WS_URL=wss://YOUR_PUBLIC_API_HOST/ws
   EXPO_PUBLIC_ENABLE_DEMO_FALLBACK=false
   ```

7. Start Expo tunnel mode for Expo Go testing:

   ```powershell
   npm.cmd run dev:mobile:tunnel
   ```

For a later installable Android preview build, use the `preview` profile in `apps/mobile/eas.json` after Expo/EAS login and project setup.

## One-command external test

On this Windows workspace, this command starts the API, creates a Cloudflare quick tunnel for the API, starts Expo's official tunnel for Expo Go, updates `apps/mobile/.env`, and prints the Expo Go URL.

```powershell
npm.cmd run dev:external
```

Use the `expoGoUrl` value from the output. It should usually start with `exp://` and end with `.exp.direct`.

## Friend test script

Ask each tester to do this:

1. Open the Expo link.
2. Check that the onboarding screen shows a public API URL, not `192.168.x.x`, `localhost`, or `127.0.0.1`.
3. Sign in with a different Runner ID.
4. Add each other as friends.
5. One person starts a group run and invites the other.
6. The invited person joins from Home > Invited Runs.
7. Both phones enter the live screen.
8. Check `Live sync: connected`.
9. Press `Send Cheer`.
10. Finish the run and confirm the result says `Result saved`.

## Failure checks

If sign-in fails:

- Open `https://YOUR_PUBLIC_API_HOST/health` on the same phone.
- If it does not open, the API host/tunnel is down.
- If the onboarding screen says `same Wi-Fi only`, the app is still using a private LAN address.

If live sync reconnects:

- Keep running. The app keeps the latest route point on the phone and retries WebSocket.
- When it reconnects, Group Status should return to connected.

If finish save fails:

- The result is kept on the phone.
- Press `Retry Save` after the API is reachable again.
