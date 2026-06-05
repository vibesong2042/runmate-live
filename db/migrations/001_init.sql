CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE auth_provider AS ENUM ('email', 'apple', 'google');
CREATE TYPE unit_system AS ENUM ('metric', 'imperial');
CREATE TYPE visibility AS ENUM ('private', 'friends');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');
CREATE TYPE session_type AS ENUM ('solo', 'friend', 'group');
CREATE TYPE session_status AS ENUM ('scheduled', 'ready', 'active', 'finished', 'cancelled');
CREATE TYPE participant_status AS ENUM ('invited', 'joined', 'ready', 'running', 'paused', 'finished', 'left');
CREATE TYPE live_run_state AS ENUM ('running', 'paused', 'finished', 'lost_signal');
CREATE TYPE challenge_type AS ENUM ('distance', 'frequency', 'group_distance', 'pace');
CREATE TYPE challenge_visibility AS ENUM ('private', 'friends', 'public');
CREATE TYPE achievement_condition_type AS ENUM ('first_run', 'distance_total', 'streak', 'group_runs', 'personal_best');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  provider auth_provider NOT NULL,
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 30),
  runner_id text NOT NULL UNIQUE CHECK (runner_id ~ '^[a-zA-Z0-9_]{3,24}$'),
  profile_image_url text,
  birth_year integer,
  gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  unit unit_system NOT NULL DEFAULT 'metric',
  default_privacy visibility NOT NULL DEFAULT 'friends',
  location_consent_at timestamptz,
  marketing_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_consent boolean NOT NULL,
  background_location_consent boolean NOT NULL,
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  blocked_at timestamptz,
  CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX friendships_unique_pair_idx
ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE TABLE running_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  type session_type NOT NULL,
  status session_status NOT NULL,
  target_distance_meters integer CHECK (target_distance_meters > 0),
  target_duration_seconds integer CHECK (target_duration_seconds > 0),
  scheduled_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  location_sharing_required boolean NOT NULL DEFAULT true,
  voice_feedback_enabled boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'invited_only' CHECK (visibility = 'invited_only'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE running_session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES running_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status participant_status NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  total_distance_meters numeric(10, 2) NOT NULL DEFAULT 0,
  moving_time_seconds integer NOT NULL DEFAULT 0,
  average_pace_sec_per_km integer,
  current_pace_sec_per_km integer,
  last_location_at timestamptz,
  UNIQUE (session_id, user_id)
);

CREATE TABLE live_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES running_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position geography(Point, 4326) NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  altitude numeric(10, 2),
  accuracy_meters numeric(8, 2),
  heading numeric(6, 2),
  speed_mps numeric(8, 3),
  current_pace_sec_per_km integer,
  average_pace_sec_per_km integer,
  distance_meters numeric(10, 2) NOT NULL,
  state live_run_state NOT NULL,
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX live_locations_session_user_recorded_idx
ON live_locations (session_id, user_id, recorded_at DESC);

CREATE INDEX live_locations_position_idx
ON live_locations USING gist (position);

CREATE TABLE activity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES running_sessions(id) ON DELETE SET NULL,
  distance_meters numeric(10, 2) NOT NULL,
  duration_seconds integer NOT NULL,
  moving_time_seconds integer NOT NULL,
  average_pace_sec_per_km integer NOT NULL,
  best_pace_sec_per_km integer,
  max_speed_mps numeric(8, 3),
  calories_estimate integer,
  route_polyline text NOT NULL,
  map_snapshot_url text,
  visibility visibility NOT NULL DEFAULT 'friends',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX activity_records_session_user_unique_idx
ON activity_records (session_id, user_id)
WHERE session_id IS NOT NULL;

CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  type challenge_type NOT NULL,
  target_value numeric(12, 2) NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  visibility challenge_visibility NOT NULL,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE TABLE achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  icon_url text NOT NULL,
  condition_type achievement_condition_type NOT NULL,
  condition_value numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  source_activity_id uuid REFERENCES activity_records(id) ON DELETE SET NULL,
  UNIQUE (user_id, achievement_id)
);

CREATE TABLE safety_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE session_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES running_sessions(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
