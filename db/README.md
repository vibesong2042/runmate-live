# Database

The MVP database uses PostgreSQL with PostGIS.

## Local setup

```bash
docker compose up -d postgres redis
psql "postgres://runmate:runmate@localhost:5432/runmate" -f db/migrations/001_init.sql
```

## Notes

- `live_locations.position` stores a PostGIS geography point for route and proximity queries.
- The app also stores raw `latitude` and `longitude` columns to keep API serialization simple.
- Detailed route visibility should default to private/friends-only at the API layer, even when an activity summary is shared.
