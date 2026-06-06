import { randomUUID } from "node:crypto";
import pg from "pg";
import type {
  ActivityRecord,
  Friendship,
  LiveLocation,
  RunningSession,
  RunningSessionParticipant,
  User,
} from "@runmate/shared";
import { calculateAveragePaceSecPerKm } from "@runmate/shared";
import { DEV_USER_ID } from "../auth/dev-user.js";
import type { CreateSessionInput, PrivacyConsent, RunMateStore } from "./store-types.js";

const { Pool } = pg;

type Row = Record<string, unknown>;

function iso(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value.toISOString() : String(value);
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function mapUser(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    provider: row.provider as User["provider"],
    nickname: String(row.nickname),
    runnerId: String(row.runner_id),
    profileImageUrl: row.profile_image_url ? String(row.profile_image_url) : undefined,
    birthYear: row.birth_year ? Number(row.birth_year) : undefined,
    gender: row.gender as User["gender"],
    unit: row.unit as User["unit"],
    defaultPrivacy: row.default_privacy as User["defaultPrivacy"],
    locationConsentAt: iso(row.location_consent_at),
    marketingConsentAt: iso(row.marketing_consent_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    deletedAt: iso(row.deleted_at),
  };
}

function mapFriendship(row: Row): Friendship {
  return {
    id: String(row.id),
    requesterId: String(row.requester_id),
    addresseeId: String(row.addressee_id),
    status: row.status as Friendship["status"],
    createdAt: iso(row.created_at)!,
    acceptedAt: iso(row.accepted_at),
    blockedAt: iso(row.blocked_at),
  };
}

function mapSession(row: Row): RunningSession {
  return {
    id: String(row.id),
    hostUserId: String(row.host_user_id),
    title: String(row.title),
    type: row.type as RunningSession["type"],
    status: row.status as RunningSession["status"],
    targetDistanceMeters: row.target_distance_meters ? Number(row.target_distance_meters) : undefined,
    targetDurationSeconds: row.target_duration_seconds ? Number(row.target_duration_seconds) : undefined,
    scheduledStartAt: iso(row.scheduled_start_at),
    startedAt: iso(row.started_at),
    endedAt: iso(row.ended_at),
    locationSharingRequired: Boolean(row.location_sharing_required),
    voiceFeedbackEnabled: Boolean(row.voice_feedback_enabled),
    visibility: "invited_only",
    createdAt: iso(row.created_at)!,
  };
}

function mapParticipant(row: Row): RunningSessionParticipant {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    userId: String(row.user_id),
    status: row.status as RunningSessionParticipant["status"],
    startedAt: iso(row.started_at),
    endedAt: iso(row.ended_at),
    totalDistanceMeters: num(row.total_distance_meters),
    movingTimeSeconds: num(row.moving_time_seconds),
    averagePaceSecPerKm: row.average_pace_sec_per_km ? Number(row.average_pace_sec_per_km) : undefined,
    currentPaceSecPerKm: row.current_pace_sec_per_km ? Number(row.current_pace_sec_per_km) : undefined,
    lastLocationAt: iso(row.last_location_at),
  };
}

function mapLocation(row: Row): LiveLocation {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    userId: String(row.user_id),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    altitude: row.altitude ? Number(row.altitude) : undefined,
    accuracyMeters: row.accuracy_meters ? Number(row.accuracy_meters) : undefined,
    heading: row.heading ? Number(row.heading) : undefined,
    speedMps: row.speed_mps ? Number(row.speed_mps) : undefined,
    currentPaceSecPerKm: row.current_pace_sec_per_km ? Number(row.current_pace_sec_per_km) : undefined,
    averagePaceSecPerKm: row.average_pace_sec_per_km ? Number(row.average_pace_sec_per_km) : undefined,
    distanceMeters: num(row.distance_meters),
    state: row.state as LiveLocation["state"],
    recordedAt: iso(row.recorded_at)!,
    receivedAt: iso(row.received_at)!,
  };
}

function mapActivity(row: Row): ActivityRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionId: row.session_id ? String(row.session_id) : undefined,
    distanceMeters: num(row.distance_meters),
    durationSeconds: Number(row.duration_seconds),
    movingTimeSeconds: Number(row.moving_time_seconds),
    averagePaceSecPerKm: Number(row.average_pace_sec_per_km),
    bestPaceSecPerKm: row.best_pace_sec_per_km ? Number(row.best_pace_sec_per_km) : undefined,
    maxSpeedMps: row.max_speed_mps ? Number(row.max_speed_mps) : undefined,
    caloriesEstimate: row.calories_estimate ? Number(row.calories_estimate) : undefined,
    routePolyline: String(row.route_polyline),
    mapSnapshotUrl: row.map_snapshot_url ? String(row.map_snapshot_url) : undefined,
    visibility: row.visibility as ActivityRecord["visibility"],
    createdAt: iso(row.created_at)!,
  };
}

export class PgStore implements RunMateStore {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async createUser(input: Pick<User, "email" | "nickname" | "runnerId" | "provider">): Promise<User> {
    const result = await this.pool.query(
      `INSERT INTO users (email, provider, nickname, runner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.email, input.provider, input.nickname, input.runnerId],
    );
    return mapUser(result.rows[0]);
  }

  async getUser(userId: string): Promise<User | undefined> {
    const result = await this.pool.query("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [userId]);
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async hasUser(userId: string): Promise<boolean> {
    return Boolean(await this.getUser(userId));
  }

  async getDevUser(): Promise<User | undefined> {
    await this.pool.query(
      `INSERT INTO users (id, email, provider, nickname, runner_id, location_consent_at)
       VALUES ($1, 'runner@example.com', 'email', 'Runner', 'runner', now())
       ON CONFLICT (id) DO NOTHING`,
      [DEV_USER_ID],
    );
    return this.getUser(DEV_USER_ID);
  }

  async updateDefaultPrivacy(userId: string, defaultPrivacy: User["defaultPrivacy"]): Promise<User | undefined> {
    const result = await this.pool.query(
      `UPDATE users SET default_privacy = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [userId, defaultPrivacy],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async searchUsersByRunnerId(runnerId: string): Promise<User[]> {
    const result = await this.pool.query(
      `SELECT * FROM users WHERE deleted_at IS NULL AND runner_id ILIKE $1 ORDER BY runner_id LIMIT 20`,
      [`%${runnerId}%`],
    );
    return result.rows.map(mapUser);
  }

  async recordPrivacyConsent(input: Omit<PrivacyConsent, "id" | "consentedAt">): Promise<PrivacyConsent> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO privacy_consents
         (user_id, location_consent, background_location_consent, marketing_consent, consent_version)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          input.userId,
          input.locationConsent,
          input.backgroundLocationConsent,
          input.marketingConsent,
          input.consentVersion,
        ],
      );
      await client.query(
        `UPDATE users
         SET location_consent_at = CASE WHEN $2 THEN now() ELSE NULL END,
             marketing_consent_at = CASE WHEN $3 THEN now() ELSE NULL END,
             updated_at = now()
         WHERE id = $1`,
        [input.userId, input.locationConsent, input.marketingConsent],
      );
      await client.query("COMMIT");
      const row = result.rows[0];
      return {
        id: String(row.id),
        userId: String(row.user_id),
        locationConsent: Boolean(row.location_consent),
        backgroundLocationConsent: Boolean(row.background_location_consent),
        marketingConsent: Boolean(row.marketing_consent),
        consentVersion: String(row.consent_version),
        consentedAt: iso(row.consented_at)!,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listPrivacyConsents(userId: string): Promise<PrivacyConsent[]> {
    const result = await this.pool.query(
      "SELECT * FROM privacy_consents WHERE user_id = $1 ORDER BY consented_at DESC",
      [userId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      locationConsent: Boolean(row.location_consent),
      backgroundLocationConsent: Boolean(row.background_location_consent),
      marketingConsent: Boolean(row.marketing_consent),
      consentVersion: String(row.consent_version),
      consentedAt: iso(row.consented_at)!,
    }));
  }

  async addFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const result = await this.pool.query(
      `INSERT INTO friendships (requester_id, addressee_id)
       VALUES ($1, $2)
       RETURNING *`,
      [requesterId, addresseeId],
    );
    return mapFriendship(result.rows[0]);
  }

  async listAcceptedFriendships(userId: string): Promise<Friendship[]> {
    const result = await this.pool.query(
      `SELECT * FROM friendships
       WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
       ORDER BY accepted_at DESC NULLS LAST`,
      [userId],
    );
    return result.rows.map(mapFriendship);
  }

  async listPendingFriendRequests(userId: string): Promise<Friendship[]> {
    const result = await this.pool.query(
      `SELECT * FROM friendships WHERE addressee_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(mapFriendship);
  }

  async getFriendship(friendshipId: string): Promise<Friendship | undefined> {
    const result = await this.pool.query("SELECT * FROM friendships WHERE id = $1", [friendshipId]);
    return result.rows[0] ? mapFriendship(result.rows[0]) : undefined;
  }

  async updateFriendshipStatus(
    friendshipId: string,
    status: Extract<Friendship["status"], "accepted" | "declined">,
  ): Promise<Friendship | undefined> {
    const result = await this.pool.query(
      `UPDATE friendships
       SET status = $2, accepted_at = CASE WHEN $2 = 'accepted' THEN now() ELSE accepted_at END
       WHERE id = $1
       RETURNING *`,
      [friendshipId, status],
    );
    return result.rows[0] ? mapFriendship(result.rows[0]) : undefined;
  }

  async createSession(input: CreateSessionInput): Promise<RunningSession> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const sessionResult = await client.query(
        `INSERT INTO running_sessions
         (host_user_id, title, type, status, target_distance_meters, target_duration_seconds,
          scheduled_start_at, location_sharing_required, voice_feedback_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          input.hostUserId,
          input.title,
          input.type,
          input.scheduledStartAt ? "scheduled" : "ready",
          input.targetDistanceMeters,
          input.targetDurationSeconds,
          input.scheduledStartAt,
          input.locationSharingRequired,
          input.voiceFeedbackEnabled,
        ],
      );
      const session = mapSession(sessionResult.rows[0]);
      const participantIds = [...new Set([input.hostUserId, ...input.participantUserIds])];
      for (const userId of participantIds) {
        await client.query(
          `INSERT INTO running_session_participants (session_id, user_id, status)
           VALUES ($1, $2, $3)`,
          [session.id, userId, userId === input.hostUserId ? "joined" : "invited"],
        );
      }
      await client.query("COMMIT");
      return session;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSession(sessionId: string): Promise<RunningSession | undefined> {
    const result = await this.pool.query("SELECT * FROM running_sessions WHERE id = $1", [sessionId]);
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }

  async listSessionsForUser(userId: string): Promise<RunningSession[]> {
    const result = await this.pool.query(
      `SELECT s.*
       FROM running_sessions s
       JOIN running_session_participants p ON p.session_id = s.id
       WHERE p.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return result.rows.map(mapSession);
  }

  async updateSessionParticipantStatus(
    sessionId: string,
    userId: string,
    status: RunningSessionParticipant["status"],
  ): Promise<RunningSessionParticipant | undefined> {
    const result = await this.pool.query(
      `UPDATE running_session_participants
       SET status = $3,
           started_at = CASE
             WHEN $3 IN ('joined', 'ready', 'running') AND started_at IS NULL THEN now()
             ELSE started_at
           END,
           ended_at = CASE WHEN $3 = 'finished' THEN now() ELSE ended_at END
       WHERE session_id = $1 AND user_id = $2
       RETURNING *`,
      [sessionId, userId, status],
    );
    return result.rows[0] ? mapParticipant(result.rows[0]) : undefined;
  }

  async updateSessionStatus(
    sessionId: string,
    status: Extract<RunningSession["status"], "active" | "finished">,
    timestamp: string,
  ): Promise<RunningSession | undefined> {
    const result = await this.pool.query(
      `UPDATE running_sessions
       SET status = $2,
           started_at = CASE WHEN $2 = 'active' THEN $3 ELSE started_at END,
           ended_at = CASE WHEN $2 = 'finished' THEN $3 ELSE ended_at END
       WHERE id = $1
       RETURNING *`,
      [sessionId, status, timestamp],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }

  async getSessionParticipants(sessionId: string): Promise<RunningSessionParticipant[]> {
    const result = await this.pool.query(
      "SELECT * FROM running_session_participants WHERE session_id = $1 ORDER BY id",
      [sessionId],
    );
    return result.rows.map(mapParticipant);
  }

  async upsertLiveLocation(location: LiveLocation): Promise<void> {
    await this.pool.query(
      `INSERT INTO live_locations
       (id, session_id, user_id, latitude, longitude, altitude, accuracy_meters, heading,
        speed_mps, current_pace_sec_per_km, average_pace_sec_per_km, distance_meters, state, recorded_at, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        location.id,
        location.sessionId,
        location.userId,
        location.latitude,
        location.longitude,
        location.altitude,
        location.accuracyMeters,
        location.heading,
        location.speedMps,
        location.currentPaceSecPerKm,
        location.averagePaceSecPerKm,
        location.distanceMeters,
        location.state,
        location.recordedAt,
        location.receivedAt,
      ],
    );
    await this.pool.query(
      `UPDATE running_session_participants
       SET status = CASE WHEN $3 = 'lost_signal' THEN status ELSE $3::participant_status END,
           total_distance_meters = $4,
           average_pace_sec_per_km = $5,
           current_pace_sec_per_km = $6,
           last_location_at = $7
       WHERE session_id = $1 AND user_id = $2`,
      [
        location.sessionId,
        location.userId,
        location.state,
        location.distanceMeters,
        location.averagePaceSecPerKm,
        location.currentPaceSecPerKm,
        location.recordedAt,
      ],
    );
  }

  async listLatestLocations(sessionId: string): Promise<LiveLocation[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT ON (user_id) *
       FROM live_locations
       WHERE session_id = $1
       ORDER BY user_id, recorded_at DESC`,
      [sessionId],
    );
    return result.rows.map(mapLocation);
  }

  async listActivities(userId: string): Promise<ActivityRecord[]> {
    const result = await this.pool.query(
      "SELECT * FROM activity_records WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    return result.rows.map(mapActivity);
  }

  async createActivitiesForSession(sessionId: string): Promise<ActivityRecord[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return [];
    }

    const participants = await this.getSessionParticipants(sessionId);
    const endedAt = session.endedAt ?? new Date().toISOString();
    const startedAt = session.startedAt ?? session.createdAt;
    const durationSeconds = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000));
    const activities: ActivityRecord[] = [];

    for (const participant of participants.filter((item) => item.totalDistanceMeters > 0)) {
      const movingTimeSeconds = participant.movingTimeSeconds || durationSeconds;
      const averagePaceSecPerKm =
        participant.averagePaceSecPerKm ??
        calculateAveragePaceSecPerKm(participant.totalDistanceMeters, movingTimeSeconds) ??
        0;
      const result = await this.pool.query(
        `INSERT INTO activity_records
         (id, user_id, session_id, distance_meters, duration_seconds, moving_time_seconds,
          average_pace_sec_per_km, route_polyline, visibility, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '', 'friends', $8)
         ON CONFLICT (session_id, user_id) WHERE session_id IS NOT NULL
         DO UPDATE SET
           distance_meters = EXCLUDED.distance_meters,
           duration_seconds = EXCLUDED.duration_seconds,
           moving_time_seconds = EXCLUDED.moving_time_seconds,
           average_pace_sec_per_km = EXCLUDED.average_pace_sec_per_km,
           created_at = EXCLUDED.created_at
         RETURNING *`,
        [
          randomUUID(),
          participant.userId,
          sessionId,
          participant.totalDistanceMeters,
          durationSeconds,
          movingTimeSeconds,
          averagePaceSecPerKm,
          endedAt,
        ],
      );
      if (result.rows[0]) {
        activities.push(mapActivity(result.rows[0]));
      }
    }

    return activities;
  }
}
