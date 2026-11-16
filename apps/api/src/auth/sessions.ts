import { createHmac, randomBytes } from 'node:crypto';
import type { Queryable } from '../db/db.ts';

export interface SessionUser {
  readonly sessionId: string;
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly role: string;
  readonly avatarUrl: string | null;
  readonly mustChangePassword: boolean;
}

/**
 * Opaque bearer sessions. The client gets 32 random bytes (base64url); the
 * database stores only HMAC-SHA256(AUTH_SECRET, token). Logout, password
 * resets and disabling an account revoke sessions immediately.
 */
export class SessionService {
  private readonly secret: string;
  private readonly ttlHours: number;

  constructor(secret: string, ttlHours: number) {
    this.secret = secret;
    this.ttlHours = ttlHours;
  }

  hashToken(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }

  async create(q: Queryable, userId: string, meta: { ip: string | null; userAgent: string | null }): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const { rows } = await q.query<{ expires_at: Date }>(
      `INSERT INTO auth_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, CURRENT_TIMESTAMP + make_interval(hours => $3), $4::inet, $5)
       RETURNING expires_at`,
      [userId, this.hashToken(token), this.ttlHours, meta.ip, meta.userAgent?.slice(0, 512) ?? null],
    );
    return { token, expiresAt: rows[0]!.expires_at };
  }

  /** The signed-in user for a token, or null (expired / revoked / disabled / deleted). */
  async resolve(q: Queryable, token: string): Promise<SessionUser | null> {
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
    const { rows } = await q.query<SessionUser & { last_seen_at: Date }>(
      `SELECT s.id AS "sessionId", s.last_seen_at, u.id, u.username, u.display_name AS "displayName", u.role,
              u.avatar_url AS "avatarUrl", u.must_change_password AS "mustChangePassword"
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP
          AND u.deleted_at IS NULL AND u.status = 'ACTIVE'`,
      [this.hashToken(token)],
    );
    const row = rows[0];
    if (!row) return null;
    // Sliding activity stamp, written at most every 5 minutes.
    if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60_000) {
      await q.query('UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [row.sessionId]);
    }
    const { last_seen_at: _seen, ...user } = row;
    return user;
  }

  revoke(q: Queryable, sessionId: string) {
    return q.query('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL', [sessionId]);
  }

  /** Revoke every session of a user (optionally keeping one). */
  revokeAll(q: Queryable, userId: string, exceptSessionId: string | null = null) {
    return q.query(
      'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid)',
      [userId, exceptSessionId],
    );
  }
}
