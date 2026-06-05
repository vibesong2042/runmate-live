WITH ranked_activities AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY session_id, user_id
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM activity_records
  WHERE session_id IS NOT NULL
)
DELETE FROM activity_records
USING ranked_activities
WHERE activity_records.id = ranked_activities.id
  AND ranked_activities.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS activity_records_session_user_unique_idx
ON activity_records (session_id, user_id)
WHERE session_id IS NOT NULL;
