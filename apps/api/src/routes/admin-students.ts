import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { currentUser } from '../auth/guard.ts';
import { hashPassword, PasswordSchema } from '../auth/passwords.ts';
import type { Queryable } from '../db/db.ts';
import { findLevelId } from '../domain/levels.ts';
import { audit } from '../http/audit.ts';
import { notFound, unprocessable } from '../http/errors.ts';
import { likeEscape, Pagination, UuidParam } from '../http/sql.ts';

/** Same rule as the users.username CHECK constraint. */
const Username = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/, '3–32 letters, digits, dot, dash or underscore; starts with a letter or digit.');
const DisplayName = z.string().trim().min(1).max(80);
const ClassLabel = z.string().trim().max(60).nullable();

const CreateStudentBody = z
  .object({
    username: Username,
    displayName: DisplayName,
    password: PasswordSchema,
    classLabel: ClassLabel.optional(),
    /** New accounts normally pick their own password at first sign-in. */
    mustChangePassword: z.boolean().default(true),
  })
  .strict();

const PatchStudentBody = z
  .object({
    displayName: DisplayName,
    status: z.enum(['ACTIVE', 'DISABLED']),
    avatarUrl: z.url().max(2048).nullable(),
    classLabel: ClassLabel,
    notes: z.string().max(2000).nullable(),
    /** Clears a temporary sign-in lockout (too many wrong passwords). */
    clearLoginLock: z.literal(true),
  })
  .partial()
  .strict();

const ResetPasswordBody = z.object({ newPassword: PasswordSchema, mustChangePassword: z.boolean().default(true) }).strict();

const ListQuery = Pagination.extend({
  search: z.string().trim().max(64).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'PENDING']).optional(),
  sort: z.enum(['username', 'name', 'xp', 'stars', 'levels', 'activity', 'created']).default('username'),
  dir: z.enum(['asc', 'desc']).optional(),
}).strict();

/** Sort keys → SQL (identifiers from code only). Ties break on username. */
const SORTS: Record<z.infer<typeof ListQuery>['sort'], { sql: string; dir: 'ASC' | 'DESC' }> = {
  username: { sql: 'u.username_normalized', dir: 'ASC' },
  name: { sql: 'lower(u.display_name)', dir: 'ASC' },
  xp: { sql: 'COALESCE(st.total_xp, 0)', dir: 'DESC' },
  stars: { sql: 'COALESCE(st.total_stars, 0)', dir: 'DESC' },
  levels: { sql: 'COALESCE(st.levels_completed, 0)', dir: 'DESC' },
  activity: { sql: '"lastActivityAt"', dir: 'DESC' },
  created: { sql: 'u.created_at', dir: 'DESC' },
};

const AccessParams = z.object({ studentId: z.uuid(), levelId: z.string().min(1).max(80) }).strict();
const AccessBody = z
  .object({ reason: z.string().trim().max(500).optional(), expiresAt: z.iso.datetime({ offset: true }).optional() })
  .strict()
  .default({});

const STUDENT_FIELDS = `u.id, u.username, u.display_name AS "displayName", u.avatar_url AS "avatarUrl", u.status,
  u.must_change_password AS "mustChangePassword", u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt",
  (u.locked_until IS NOT NULL AND u.locked_until > CURRENT_TIMESTAMP) AS "loginLocked",
  sp.class_label AS "classLabel", sp.notes,
  COALESCE(st.total_xp, 0) AS "totalXp", COALESCE(st.total_stars, 0) AS "totalStars",
  COALESCE(st.levels_completed, 0) AS "levelsCompleted", COALESCE(st.current_streak, 0) AS "currentStreak",
  GREATEST(u.last_login_at, (SELECT max(a.started_at) FROM level_attempts a WHERE a.student_id = u.id)) AS "lastActivityAt"`;

const STUDENT_FROM = `users u LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN student_stats st ON st.student_id = u.id`;

/** A student account (never an admin; never soft-deleted), or 404. Columns are explicit — password_hash is never selected. */
async function getStudent(q: Queryable, id: string, lock = false) {
  const { rows } = await q.query<{ id: string; username: string; displayName: string; status: string; classLabel: string | null; [k: string]: unknown }>(
    `SELECT ${STUDENT_FIELDS} FROM ${STUDENT_FROM} WHERE u.id = $1 AND u.role = 'STUDENT' AND u.deleted_at IS NULL ${lock ? 'FOR UPDATE OF u' : ''}`,
    [id],
  );
  if (!rows[0]) throw notFound('Student');
  return rows[0];
}

export function registerAdminStudentRoutes(app: FastifyInstance, { db, sessions, permissions }: AppDeps) {
  const can = (permission: string) => ({ preHandler: permissions.require(permission) });

  // ── accounts ───────────────────────────────────────────────────────────
  app.get('/api/admin/students', can('students.view'), async (req) => {
    const query = ListQuery.parse(req.query);
    const search = query.search ? `%${likeEscape(query.search.toLowerCase())}%` : null;
    const where = `u.role = 'STUDENT' AND u.deleted_at IS NULL
      AND ($1::text IS NULL OR u.username_normalized LIKE $1 OR lower(u.display_name) LIKE $1 OR lower(sp.class_label) LIKE $1)
      AND ($2::user_status IS NULL OR u.status = $2::user_status)`;
    const params = [search, query.status ?? null];
    const sort = SORTS[query.sort];
    const order = `${sort.sql} ${query.dir ? query.dir.toUpperCase() : sort.dir}`;
    const [{ rows }, { rows: total }] = await Promise.all([
      db.query(`SELECT ${STUDENT_FIELDS} FROM ${STUDENT_FROM} WHERE ${where} ORDER BY ${order} NULLS LAST, u.username_normalized LIMIT $3 OFFSET $4`, [
        ...params,
        query.pageSize,
        (query.page - 1) * query.pageSize,
      ]),
      db.query<{ n: number }>(`SELECT count(*) AS n FROM ${STUDENT_FROM} WHERE ${where}`, params),
    ]);
    return { students: rows, page: query.page, pageSize: query.pageSize, total: total[0]?.n ?? 0 };
  });

  app.get('/api/admin/students/:id', can('students.view'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    return { student: await getStudent(db, id) };
  });

  app.post('/api/admin/students', can('students.manage'), async (req, reply) => {
    const body = CreateStudentBody.parse(req.body);
    if (body.password.toLowerCase() === body.username.toLowerCase()) throw unprocessable('WEAK_PASSWORD', 'The password cannot be the username.');
    const hash = await hashPassword(body.password);
    const student = await db.tx(async (q) => {
      // Usernames are unique case-insensitively (23505 → 409 CONFLICT).
      const { rows } = await q.query<{ id: string }>(
        `INSERT INTO users (username, password_hash, display_name, role, must_change_password, created_by)
         VALUES ($1, $2, $3, 'STUDENT', $4, $5) RETURNING id`,
        [body.username, hash, body.displayName, body.mustChangePassword, currentUser(req).id],
      );
      const id = rows[0]!.id;
      await q.query('INSERT INTO student_profiles (user_id, class_label) VALUES ($1, $2)', [id, body.classLabel ?? null]);
      await q.query('INSERT INTO student_settings (student_id) VALUES ($1)', [id]);
      await q.query('INSERT INTO student_stats (student_id) VALUES ($1)', [id]);
      const created = await getStudent(q, id);
      // The password (and its hash) never go into the audit log.
      await audit(q, req, { action: 'CREATE_STUDENT', entityType: 'user', entityId: id, newData: { username: created.username, displayName: created.displayName, classLabel: created.classLabel } });
      return created;
    });
    return reply.status(201).send({ student });
  });

  app.patch('/api/admin/students/:id', can('students.manage'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = PatchStudentBody.parse(req.body);
    if (Object.keys(body).length === 0) throw unprocessable('NOTHING_TO_UPDATE', 'Nothing to update.');
    const student = await db.tx(async (q) => {
      const before = await getStudent(q, id, true);
      const sets: string[] = [];
      const params: unknown[] = [id];
      const set = (col: string, value: unknown, cast = '') => {
        params.push(value);
        sets.push(`${col} = $${params.length}${cast}`);
      };
      if (body.displayName !== undefined) set('display_name', body.displayName);
      if (body.status !== undefined) set('status', body.status, '::user_status');
      if (body.avatarUrl !== undefined) set('avatar_url', body.avatarUrl);
      if (body.clearLoginLock) {
        sets.push('failed_login_count = 0', 'locked_until = NULL');
      }
      if (sets.length) await q.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, params);
      if (body.classLabel !== undefined || body.notes !== undefined) {
        await q.query(
          `INSERT INTO student_profiles (user_id, class_label, notes) VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE SET
             class_label = CASE WHEN $4::boolean THEN EXCLUDED.class_label ELSE student_profiles.class_label END,
             notes = CASE WHEN $5::boolean THEN EXCLUDED.notes ELSE student_profiles.notes END`,
          [id, body.classLabel ?? null, body.notes ?? null, body.classLabel !== undefined, body.notes !== undefined],
        );
      }
      const statusChanged = body.status !== undefined && body.status !== before.status;
      // A disabled account is signed out everywhere, immediately.
      if (statusChanged && body.status === 'DISABLED') await sessions.revokeAll(q, id);
      const after = await getStudent(q, id);
      const action = statusChanged ? (body.status === 'DISABLED' ? 'DISABLE_STUDENT' : 'ENABLE_STUDENT') : 'UPDATE_STUDENT';
      const pick = (s: Record<string, unknown>) => ({ displayName: s.displayName, status: s.status, avatarUrl: s.avatarUrl, classLabel: s.classLabel, notes: s.notes, loginLocked: s.loginLocked });
      await audit(q, req, { action, entityType: 'user', entityId: id, oldData: pick(before), newData: pick(after) });
      return after;
    });
    return { student };
  });

  app.post('/api/admin/students/:id/reset-password', can('students.manage'), async (req, reply) => {
    const { id } = UuidParam.parse(req.params);
    const body = ResetPasswordBody.parse(req.body);
    const hash = await hashPassword(body.newPassword);
    await db.tx(async (q) => {
      const student = await getStudent(q, id, true);
      if (body.newPassword.toLowerCase() === student.username.toLowerCase()) throw unprocessable('WEAK_PASSWORD', 'The password cannot be the username.');
      await q.query(
        `UPDATE users SET password_hash = $2, must_change_password = $3, password_changed_at = CURRENT_TIMESTAMP, failed_login_count = 0, locked_until = NULL
          WHERE id = $1`,
        [id, hash, body.mustChangePassword],
      );
      await sessions.revokeAll(q, id);
      await audit(q, req, { action: 'RESET_PASSWORD', entityType: 'user', entityId: id, newData: { mustChangePassword: body.mustChangePassword } });
    });
    return reply.status(204).send();
  });

  // ── reports ────────────────────────────────────────────────────────────
  app.get('/api/admin/students/:id/progress', can('progress.view'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    const student = await getStudent(db, id);
    const [{ rows: levels }, { rows: overrides }, { rows: achievements }] = await Promise.all([
      // Every non-deleted level, with the student's effective state (NULL = not visible to students).
      db.query(
        `SELECT l.id AS "levelId", l.slug, l.title, l.status AS "publishStatus", w.slug AS "worldSlug", w.name AS "worldName",
                s.state, s.reason, p.status AS "progressStatus", p.best_stars AS "bestStars", p.best_score AS "bestScore",
                p.best_time_seconds AS "bestTimeSeconds", p.attempt_count AS "attemptCount", p.hints_used AS "hintsUsed",
                p.completed_at AS "completedAt", p.last_attempt_at AS "lastAttemptAt"
           FROM levels l JOIN worlds w ON w.id = l.world_id
           LEFT JOIN get_student_level_states($1) s ON s.level_id = l.id
           LEFT JOIN student_level_progress p ON p.level_id = l.id AND p.student_id = $1
          WHERE l.deleted_at IS NULL AND w.deleted_at IS NULL
          ORDER BY w.sort_order, l.sort_order`,
        [id],
      ),
      db.query(
        `SELECT a.level_id AS "levelId", l.slug, a.status, a.override_reason AS "reason", a.expires_at AS "expiresAt", a.revoked_at AS "revokedAt",
                g.username AS "grantedBy", a.updated_at AS "updatedAt"
           FROM student_level_access a JOIN levels l ON l.id = a.level_id LEFT JOIN users g ON g.id = a.granted_by
          WHERE a.student_id = $1 ORDER BY a.updated_at DESC`,
        [id],
      ),
      db.query(
        `SELECT a.slug, a.name, sa.unlocked_at AS "unlockedAt" FROM student_achievements sa JOIN achievements a ON a.id = sa.achievement_id
          WHERE sa.student_id = $1 ORDER BY sa.unlocked_at`,
        [id],
      ),
    ]);
    return { student, levels, overrides, achievements };
  });

  app.get('/api/admin/students/:id/attempts', can('progress.view'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    const query = Pagination.extend({ levelId: z.uuid().optional() }).strict().parse(req.query);
    await getStudent(db, id);
    const { rows } = await db.query(
      `SELECT a.id, a.level_id AS "levelId", l.slug AS "levelSlug", a.attempt_number AS "attemptNumber", a.status, a.score, a.stars,
              a.execution_time_seconds AS "executionTimeSeconds", a.block_count AS "blockCount", a.collisions, a.error_message AS "errorMessage",
              a.submission_id AS "submissionId", a.program_version_id AS "programVersionId", a.result, a.started_at AS "startedAt", a.completed_at AS "completedAt"
         FROM level_attempts a JOIN levels l ON l.id = a.level_id
        WHERE a.student_id = $1 AND ($2::uuid IS NULL OR a.level_id = $2)
        ORDER BY a.started_at DESC, a.attempt_number DESC LIMIT $3 OFFSET $4`,
      [id, query.levelId ?? null, query.pageSize, (query.page - 1) * query.pageSize],
    );
    return { attempts: rows, page: query.page, pageSize: query.pageSize };
  });

  app.get('/api/admin/students/:id/programs', can('progress.view'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    await getStudent(db, id);
    const { rows } = await db.query(
      `SELECT p.id, p.level_id AS "levelId", l.slug AS "levelSlug", l.title AS "levelTitle", p.name, p.version, p.is_submitted AS "isSubmitted",
              p.block_program AS "blockProgram", p.python_code AS "pythonCode", p.updated_at AS "updatedAt"
         FROM programs p JOIN levels l ON l.id = p.level_id
        WHERE p.student_id = $1 AND p.deleted_at IS NULL ORDER BY p.updated_at DESC`,
      [id],
    );
    return { programs: rows };
  });

  app.get('/api/admin/programs/:id', can('progress.view'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    const { rows } = await db.query(
      `SELECT p.id, p.student_id AS "studentId", u.username, u.display_name AS "studentName", p.level_id AS "levelId", l.slug AS "levelSlug",
              l.title AS "levelTitle", p.name, p.version,
              p.is_submitted AS "isSubmitted", p.block_program AS "blockProgram", p.python_code AS "pythonCode", p.created_at AS "createdAt", p.updated_at AS "updatedAt"
         FROM programs p JOIN users u ON u.id = p.student_id JOIN levels l ON l.id = p.level_id
        WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id],
    );
    if (!rows[0]) throw notFound('Program');
    const { rows: versions } = await db.query(
      `SELECT id, version_number AS "versionNumber", source, block_program AS "blockProgram", python_code AS "pythonCode", created_at AS "createdAt"
         FROM program_versions WHERE program_id = $1 ORDER BY version_number DESC LIMIT 50`,
      [id],
    );
    return { program: rows[0], versions };
  });

  // ── per-student level access ───────────────────────────────────────────
  const setAccess = (status: 'AVAILABLE' | 'LOCKED', action: 'UNLOCK_LEVEL' | 'LOCK_LEVEL') =>
    async (req: FastifyRequest) => {
      const params = AccessParams.parse(req.params);
      const body = AccessBody.parse(req.body ?? {});
      if (body.expiresAt && new Date(body.expiresAt).getTime() <= Date.now()) throw unprocessable('INVALID_EXPIRY', 'expiresAt must be in the future.');
      return db.tx(async (q) => {
        await getStudent(q, params.studentId);
        const levelId = await findLevelId(q, params.levelId);
        if (!levelId) throw notFound('Level');
        const { rows: old } = await q.query('SELECT status, override_reason AS reason, expires_at AS "expiresAt", revoked_at AS "revokedAt" FROM student_level_access WHERE student_id = $1 AND level_id = $2', [
          params.studentId,
          levelId,
        ]);
        await q.query(
          `INSERT INTO student_level_access (student_id, level_id, status, override_reason, granted_by, expires_at)
           VALUES ($1, $2, $3::student_access_status, $4, $5, $6)
           ON CONFLICT (student_id, level_id) DO UPDATE SET
             status = EXCLUDED.status, override_reason = EXCLUDED.override_reason, granted_by = EXCLUDED.granted_by,
             expires_at = EXCLUDED.expires_at, revoked_at = NULL`,
          [params.studentId, levelId, status, body.reason ?? null, currentUser(req).id, body.expiresAt ?? null],
        );
        await audit(q, req, {
          action,
          entityType: 'student_level_access',
          entityId: `${params.studentId}:${levelId}`,
          oldData: old[0] ?? null,
          newData: { studentId: params.studentId, levelId, status, reason: body.reason ?? null, expiresAt: body.expiresAt ?? null },
        });
        const { rows: state } = await q.query('SELECT state, reason FROM get_student_level_states($1) WHERE level_id = $2', [params.studentId, levelId]);
        // state is null when the level isn't published/visible — the override applies once it is.
        return { access: { studentId: params.studentId, levelId, override: status, effectiveState: state[0] ?? null } };
      });
    };

  app.post('/api/admin/students/:studentId/levels/:levelId/unlock', can('levels.unlock'), setAccess('AVAILABLE', 'UNLOCK_LEVEL'));
  app.post('/api/admin/students/:studentId/levels/:levelId/lock', can('levels.unlock'), setAccess('LOCKED', 'LOCK_LEVEL'));

  /** Removes the override: the level goes back to the normal prerequisite rules. */
  app.delete('/api/admin/students/:studentId/levels/:levelId/access', can('levels.unlock'), async (req) => {
    const params = AccessParams.parse(req.params);
    return db.tx(async (q) => {
      await getStudent(q, params.studentId);
      const levelId = await findLevelId(q, params.levelId);
      if (!levelId) throw notFound('Level');
      const { rows } = await q.query(
        `UPDATE student_level_access SET revoked_at = CURRENT_TIMESTAMP WHERE student_id = $1 AND level_id = $2 AND revoked_at IS NULL RETURNING status, override_reason AS reason`,
        [params.studentId, levelId],
      );
      if (!rows[0]) throw notFound('Access override');
      await audit(q, req, { action: 'CLEAR_LEVEL_ACCESS', entityType: 'student_level_access', entityId: `${params.studentId}:${levelId}`, oldData: rows[0] });
      const { rows: state } = await q.query('SELECT state, reason FROM get_student_level_states($1) WHERE level_id = $2', [params.studentId, levelId]);
      return { access: { studentId: params.studentId, levelId, override: null, effectiveState: state[0] ?? null } };
    });
  });
}
