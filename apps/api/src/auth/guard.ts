import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Queryable } from '../db/db.ts';
import { forbidden, unauthorized } from '../http/errors.ts';
import type { SessionService, SessionUser } from './sessions.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `authenticate`; never taken from the request body. */
    user?: SessionUser;
  }
}

/** Routes a user who must change their password may still call. */
const PASSWORD_CHANGE_ALLOWED = new Set(['/api/auth/me', '/api/auth/logout', '/api/auth/change-password']);

/** Reads `Authorization: Bearer <token>` and loads the user from the session. */
export function authenticate(db: Queryable, sessions: SessionService) {
  return async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) throw unauthorized();
    const user = await sessions.resolve(db, token);
    if (!user) throw unauthorized('Your session has expired — please sign in again.');
    req.user = user;
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(req.routeOptions.url ?? '')) {
      throw forbidden('Please choose a new password first.', 'PASSWORD_CHANGE_REQUIRED');
    }
  };
}

/** The authenticated user (throws if a route forgot `authenticate`). */
export function currentUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

/**
 * Role-based permissions from the `role_permissions` table (cached briefly),
 * so new roles such as TEACHER work without code changes.
 */
export class Permissions {
  private readonly cache = new Map<string, { at: number; perms: Set<string> }>();
  private readonly db: Queryable;

  constructor(db: Queryable) {
    this.db = db;
  }

  async forRole(role: string): Promise<Set<string>> {
    const hit = this.cache.get(role);
    if (hit && Date.now() - hit.at < 60_000) return hit.perms;
    const { rows } = await this.db.query<{ permission_code: string }>('SELECT permission_code FROM role_permissions WHERE role_code = $1', [role]);
    const perms = new Set(rows.map((r) => r.permission_code));
    this.cache.set(role, { at: Date.now(), perms });
    return perms;
  }

  /** preHandler: the user's role must grant `permission`. */
  require(permission: string) {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
      const user = currentUser(req);
      if (!(await this.forRole(user.role)).has(permission)) throw forbidden();
    };
  }

  /** preHandler: the user's role must grant at least one of `permissions`. */
  requireAny(...permissions: string[]) {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
      const granted = await this.forRole(currentUser(req).role);
      if (!permissions.some((p) => granted.has(p))) throw forbidden();
    };
  }

  /** Whether the signed-in user's role grants `permission` (for checks inside a handler). */
  async has(req: FastifyRequest, permission: string): Promise<boolean> {
    return (await this.forRole(currentUser(req).role)).has(permission);
  }
}

/** preHandler: only these roles (e.g. STUDENT for "my programs"). */
export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest) => {
    if (!roles.includes(currentUser(req).role)) throw forbidden();
  };
}
