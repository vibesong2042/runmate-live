# Database

The MVP database uses standard PostgreSQL.

## Local setup

```bash
docker compose up -d postgres redis
psql "postgres://runmate:runmate@localhost:5432/runmate" -f db/migrations/001_init.sql
```

## Notes

- `live_locations` stores raw `latitude` and `longitude` columns for live route sharing.
- The MVP does not require PostGIS. Add a separate migration later if server-side proximity or spatial queries become necessary.
- Detailed route visibility should default to private/friends-only at the API layer, even when an activity summary is shared.
