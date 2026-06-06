CREATE TABLE IF NOT EXISTS friend_invites (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{4,36}$'),
  creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (accepted_by_user_id IS NULL OR accepted_by_user_id <> creator_user_id)
);

CREATE INDEX IF NOT EXISTS friend_invites_creator_user_idx
ON friend_invites (creator_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS friend_invites_expires_at_idx
ON friend_invites (expires_at);
