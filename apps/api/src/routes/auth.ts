import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { currentUser } from '../auth/guard.ts';
import { hashPassword, PasswordSchema, verifyPassword } from '../auth/passwords.ts';
import { AppError, forbidden, unprocessable } from '../http/errors.ts';

const LoginBody = z
  .object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(256),
  })
  .strict();

const ChangePasswordBody = z.object({ currentPassword: z.string().min(1).max(256), newPassword: PasswordSchema }).strict();

/** After this many wrong passwords the account is locked for LOCK_MINUTES. */
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Wrong username or password.');

interface LoginRow {
  id: string;
  password_hash: string;
  status: string;
  locked: boolean;
}

/** POST /api/auth/login — public, strictly rate limited per IP. */
export function registerLoginRoute(app: FastifyInstance, { db, sessions, config, permissions }: AppDeps) {
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: config.LOGIN_RATE_LIMIT, timeWindow: `${config.LOGIN_RATE_WINDOW_MINUTES} minutes` } } },
    async (req) => {
      const body = LoginBody.parse(req.body);
      const username = body.username.toLowerCase();
      const { rows } = await db.query<LoginRow>(
        `SELECT id, password_hash, status, (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) AS locked
           FROM users WHERE username_normalized = $1 AND deleted_at IS NULL`,
        [username],
      );
      const user = rows[0];
      // Locked accounts are not even checked (stops brute force); the answer looks the same.
      if (!user || user.locked) {
        await verifyPassword(null, body.password);
        throw invalidCredentials();
      }
      if (!(await verifyPassword(user.password_hash, body.password))) {
        await db.query(
          `UPDATE users SET
             failed_login_count = CASE WHEN failed_login_count + 1 >= $2 THEN 0 ELSE failed_login_count + 1 END,
             locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN CURRENT_TIMESTAMP + make_interval(mins => $3) ELSE locked_until END
           WHERE id = $1`,
          [user.id, MAX_FAILED, LOCK_MINUTES],
        );
        throw invalidCredentials();
      }
      // Status is only revealed to someone who knows the password.
      if (user.status !== 'ACTIVE') throw forbidden('This account is disabled. Ask your teacher for help.', 'ACCOUNT_DISABLED');

      const result = await db.tx(async (q) => {
        await q.query('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        const session = await sessions.create(q, user.id, { ip: req.ip || null, userAgent: req.headers['user-agent'] ?? null });
        const { rows: u } = await q.query<{ id: string; username: string; displayName: string; role: string; avatarUrl: string | null; mustChangePassword: boolean }>(
          `SELECT id, username, display_name AS "displayName", role, avatar_url AS "avatarUrl", must_change_password AS "mustChangePassword" FROM users WHERE id = $1`,
          [user.id],
        );
        return { session, user: u[0]! };
      });
      return {
        token: result.session.token,
        tokenType: 'Bearer',
        expiresAt: result.session.expiresAt,
        user: { ...result.user, permissions: [...(await permissions.forRole(result.user.role))].sort() },
      };
    },
  );
}

/** /api/auth/me · logout · change-password (session required). */
export function registerAuthRoutes(app: FastifyInstance, { db, sessions, permissions }: AppDeps) {
  app.get('/api/auth/me', async (req) => {
    const user = currentUser(req);
    const { sessionId: _s, ...publicUser } = user;
    return { user: { ...publicUser, permissions: [...(await permissions.forRole(user.role))].sort() } };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await sessions.revoke(db, currentUser(req).sessionId);
    return reply.status(204).send();
  });

  app.post('/api/auth/change-password', async (req, reply) => {
    const user = currentUser(req);
    const body = ChangePasswordBody.parse(req.body);
    const { rows } = await db.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    if (!(await verifyPassword(rows[0]?.password_hash ?? null, body.currentPassword))) throw invalidCredentials();
    if (body.newPassword === body.currentPassword) throw unprocessable('PASSWORD_UNCHANGED', 'Choose a different password.');
    if (body.newPassword.toLowerCase() === user.username.toLowerCase()) throw unprocessable('WEAK_PASSWORD', 'The password cannot be your username.');
    const hash = await hashPassword(body.newPassword);
    await db.tx(async (q) => {
      await q.query('UPDATE users SET password_hash = $2, must_change_password = FALSE, password_changed_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id, hash]);
      // Sign out everywhere else.
      await sessions.revokeAll(q, user.id, user.sessionId);
    });
    return reply.status(204).send();
  });
}
