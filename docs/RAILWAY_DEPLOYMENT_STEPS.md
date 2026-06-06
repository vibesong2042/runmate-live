# RunMate Live Railway deployment steps

Use this when moving from temporary external testing to real-world beta validation.

## What the user must do

Railway deploys from GitHub. This local workspace must be pushed to a GitHub repository before Railway can deploy it.

## Step 1: create or choose the GitHub repository

In GitHub:

1. Create a new repository, for example `runmate-live`.
2. Keep it private if this is only for beta testing.
3. Push this workspace to that repository.

After pushing, Railway can import the repository.

## Step 2: create the Railway project

In Railway:

1. Click `New Project`.
2. Choose `Deploy from GitHub repo`.
3. Select the RunMate repository.
4. If Railway asks which service/package to deploy, choose the API service or the root service that uses the root `railway.json`.
5. Keep the root directory as the repository root unless Railway explicitly created an API workspace service.

The root `railway.json` config tells Railway:

- Build command: `npm run build`
- Pre-deploy command: `npm run db:migrate`
- Start command: `npm --workspace @runmate/api run start`
- Health check path: `/health`

## Step 3: add PostgreSQL

In the same Railway project:

1. Click `+ New`.
2. Choose `Database`.
3. Choose `PostgreSQL`.
4. Wait until it is created.

Railway will provide a `DATABASE_URL` variable from the PostgreSQL service.

RunMate's MVP schema uses plain `latitude` and `longitude` numeric columns for live locations. It does not require the PostGIS extension, so Railway's default PostgreSQL service is enough.

## Step 4: set API service variables

Open the API service, then go to `Variables`.

Add these variables:

```text
RUNMATE_ENV=preview
API_HOST=0.0.0.0
STORE_DRIVER=postgres
REQUIRE_AUTH=true
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_ACCESS_SECRET=<long-random-value>
JWT_REFRESH_SECRET=<different-long-random-value>
CORS_ORIGIN=*
```

Do not set `API_PORT` unless Railway requires it. The API automatically uses Railway's `PORT` variable.

Generate the two JWT secrets as long random strings. They must be different.

## Step 5: deploy and get the public API URL

In the API service:

1. Go to `Settings`.
2. Find `Networking`.
3. Generate or copy the public domain.
4. It should look like `https://something.up.railway.app` or a custom domain.

Open this URL in a browser:

```text
https://YOUR_RAILWAY_API_HOST/health
```

Expected:

```json
{ "ok": true, "runtimeEnv": "preview", "storeDriver": "postgres" }
```

## Step 6: verify from this workspace

Run:

```powershell
npm.cmd run check:beta-api -- https://YOUR_RAILWAY_API_HOST
```

This must pass:

- `health`
- `login`
- `session`
- `websocket`

## Step 7: configure mobile preview build

Set the mobile preview environment to the Railway API:

```text
EXPO_PUBLIC_RUNTIME_ENV=preview
EXPO_PUBLIC_API_URL=https://YOUR_RAILWAY_API_HOST
EXPO_PUBLIC_WS_URL=wss://YOUR_RAILWAY_API_HOST/ws
EXPO_PUBLIC_ENABLE_DEMO_FALLBACK=false
```

For EAS Build, add the same values to the EAS `preview` environment.

Then build Android preview:

```powershell
eas build --profile preview --platform android
```

After this, testers install the APK. They should not need Expo Go or an `exp://` URL.

## If deployment fails

Check in this order:

1. Railway deploy logs.
2. Whether `DATABASE_URL` is set on the API service.
3. Whether `RUNMATE_ENV=preview`.
4. Whether `STORE_DRIVER=postgres`.
5. Whether `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are different.
6. Whether `/health` opens from mobile data.
7. Whether `npm.cmd run check:beta-api -- https://YOUR_RAILWAY_API_HOST` passes.
