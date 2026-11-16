import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { notFound } from '../http/errors.ts';
import { likeEscape, Pagination, UuidParam } from '../http/sql.ts';

/*
 * Read-only reporting for the admin dashboard: headline numbers, recent
 * activity, analytics, and every student's attempts / programs.
 */

/** Admin actions worth showing in the dashboard feed. */
const FEED_ACTIONS = ['UNLOCK_LEVEL', 'LOCK_LEVEL', 'CREATE_STUDENT', 'DISABLE_STUDENT', 'RESET_PASSWORD', 'PUBLISH_LEVEL', 'UNPUBLISH_LEVEL', 'REVIEW_LEVEL', 'PUBLISH_WORLD'];

const ATTEMPT_FIELDS = `a.id, a.student_id AS "studentId", u.username, u.display_name AS "studentName", a.level_id AS "levelId", l.slug AS "levelSlug",
  l.title AS "levelTitle", w.name AS "worldName", a.attempt_number AS "attemptNumber", a.status, a.score, a.stars,
  a.execution_time_seconds AS "executionTimeSeconds", a.block_count AS "blockCount", a.collisions, a.error_message AS "errorMessage",
  a.submission_id AS "submissionId", a.program_id AS "programId", a.program_version_id AS "programVersionId", a.started_at AS "startedAt", a.completed_at AS "completedAt"`;
const ATTEMPT_FROM = `level_attempts a JOIN users u ON u.id = a.student_id JOIN levels l ON l.id = a.level_id JOIN worlds w ON w.id = l.world_id`;

export function registerAdminActivityRoutes(app: FastifyInstance, { db, permissions }: AppDeps) {
  const can = (permission: string) => ({ preHandler: permissions.require(permission) });

  // ── dashboard ──────────────────────────────────────────────────────────
  app.get('/api/admin/dashboard', can('statistics.view'), async () => {
    const [{ rows: totals }, { rows: daily }, { rows: activity }] = await Promise.all([
      db.query(
        `WITH students AS (SELECT id, status, last_login_at FROM users WHERE role = 'STUDENT' AND deleted_at IS NULL),
              progress AS (SELECT p.* FROM student_level_progress p JOIN students s ON s.id = p.student_id),
              attempts AS (SELECT a.* FROM level_attempts a JOIN students s ON s.id = a.student_id)
         SELECT (SELECT count(*) FROM students)::int AS "totalStudents",
                (SELECT count(*) FROM students s WHERE s.status = 'ACTIVE' AND (s.last_login_at > CURRENT_TIMESTAMP - interval '7 days'
                   OR EXISTS (SELECT 1 FROM attempts a WHERE a.student_id = s.id AND a.started_at > CURRENT_TIMESTAMP - interval '7 days')))::int AS "activeStudents",
                (SELECT count(*) FROM levels WHERE deleted_at IS NULL AND status = 'PUBLISHED')::int AS "levelsPublished",
                (SELECT count(*) FROM levels WHERE deleted_at IS NULL AND status = 'REVIEW')::int AS "levelsInReview",
                (SELECT count(*) FROM progress WHERE status = 'COMPLETED')::int AS "levelsCompleted",
                (SELECT count(*) FROM attempts WHERE started_at >= CURRENT_DATE)::int AS "attemptsToday",
                COALESCE(round(100.0 * (SELECT count(*) FROM progress WHERE status = 'COMPLETED')
                  / NULLIF((SELECT count(*) FROM progress WHERE status <> 'NOT_STARTED'), 0), 1), 0) AS "completionRate",
                COALESCE(round((SELECT count(*) FROM attempts)::numeric
                  / NULLIF((SELECT count(DISTINCT (student_id, level_id)) FROM attempts), 0), 1), 0) AS "avgAttemptsPerLevel"`,
      ),
      db.query(
        `SELECT d::date AS day, count(a.id)::int AS attempts, count(a.id) FILTER (WHERE a.status = 'PASSED')::int AS passed
           FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') d
           LEFT JOIN level_attempts a ON a.started_at >= d AND a.started_at < d + interval '1 day'
          GROUP BY d ORDER BY d`,
      ),
      db.query(
        `(SELECT 'LEVEL_COMPLETED' AS type, p.completed_at AS at, u.display_name AS actor, NULL::text AS "actorRole",
                 u.display_name AS "studentName", l.title AS "levelTitle", NULL::text AS "entityName", p.student_id AS "studentId", l.id AS "levelId"
            FROM student_level_progress p JOIN users u ON u.id = p.student_id JOIN levels l ON l.id = p.level_id
           WHERE p.status = 'COMPLETED' AND u.deleted_at IS NULL
           ORDER BY p.completed_at DESC LIMIT 12)
         UNION ALL
         (SELECT g.action, g.created_at, a.display_name, 'ADMIN',
                 CASE g.entity_type WHEN 'user' THEN (SELECT x.display_name FROM users x WHERE x.id::text = g.entity_id)
                                    WHEN 'student_level_access' THEN (SELECT x.display_name FROM users x WHERE x.id::text = split_part(g.entity_id, ':', 1)) END,
                 CASE g.entity_type WHEN 'level' THEN (SELECT x.title FROM levels x WHERE x.id::text = g.entity_id)
                                    WHEN 'student_level_access' THEN (SELECT x.title FROM levels x WHERE x.id::text = split_part(g.entity_id, ':', 2)) END,
                 CASE g.entity_type WHEN 'world' THEN (SELECT x.name FROM worlds x WHERE x.id::text = g.entity_id) END,
                 NULL::uuid, NULL::uuid
            FROM audit_logs g LEFT JOIN users a ON a.id = g.admin_id
           WHERE g.action = ANY($1::text[])
           ORDER BY g.created_at DESC LIMIT 12)
         ORDER BY at DESC LIMIT 12`,
        [FEED_ACTIONS],
      ),
    ]);
    return { totals: totals[0], attemptsByDay: daily, recentActivity: activity };
  });

  // ── analytics ──────────────────────────────────────────────────────────
  app.get('/api/admin/statistics', can('statistics.view'), async (req) => {
    const { days } = z.object({ days: z.coerce.number().int().min(7).max(90).default(30) }).strict().parse(req.query);
    const [{ rows: totals }, { rows: levels }, { rows: worlds }, { rows: daily }, { rows: stars }] = await Promise.all([
      db.query(
        `SELECT (SELECT count(*) FROM users WHERE role = 'STUDENT' AND deleted_at IS NULL)::int AS students,
                (SELECT count(*) FROM users WHERE role = 'STUDENT' AND deleted_at IS NULL AND status = 'ACTIVE')::int AS "activeStudents",
                (SELECT count(*) FROM users WHERE role = 'STUDENT' AND deleted_at IS NULL AND last_login_at > CURRENT_TIMESTAMP - interval '7 days')::int AS "activeLast7Days",
                (SELECT count(*) FROM levels WHERE deleted_at IS NULL AND status = 'PUBLISHED')::int AS "publishedLevels",
                (SELECT count(*) FROM level_attempts)::int AS attempts,
                (SELECT count(*) FROM submissions WHERE status = 'PASSED')::int AS "passedSubmissions"`,
      ),
      db.query(
        `SELECT s.level_id AS "levelId", s.slug, s.title, s.world_name AS "worldName", l.world_id AS "worldId", l.status,
                s.attempts::int, s.students_attempted::int AS "studentsAttempted", s.passed_attempts::int AS "passedAttempts",
                s.pass_rate_percent AS "passRatePercent", s.students_completed::int AS "studentsCompleted", s.avg_best_stars AS "avgBestStars",
                (SELECT round(avg(p.best_time_seconds), 1) FROM student_level_progress p WHERE p.level_id = l.id AND p.status = 'COMPLETED') AS "avgBestTime",
                (SELECT round(avg(p.attempt_count), 1) FROM student_level_progress p WHERE p.level_id = l.id AND p.attempt_count > 0) AS "avgAttempts"
           FROM v_level_statistics s JOIN levels l ON l.id = s.level_id JOIN worlds w ON w.id = l.world_id JOIN curricula c ON c.id = w.curriculum_id
          ORDER BY c.sort_order, w.sort_order, l.sort_order`,
      ),
      db.query(
        `SELECT w.id AS "worldId", w.name, w.status,
                count(DISTINCT l.id) FILTER (WHERE l.status = 'PUBLISHED')::int AS "publishedLevels",
                count(p.id) FILTER (WHERE p.status = 'COMPLETED')::int AS completions,
                count(DISTINCT p.student_id) FILTER (WHERE p.status <> 'NOT_STARTED')::int AS "studentsStarted"
           FROM worlds w JOIN curricula c ON c.id = w.curriculum_id
           LEFT JOIN levels l ON l.world_id = w.id AND l.deleted_at IS NULL
           LEFT JOIN student_level_progress p ON p.level_id = l.id
          WHERE w.deleted_at IS NULL GROUP BY w.id, c.sort_order ORDER BY c.sort_order, w.sort_order`,
      ),
      db.query(
        `SELECT d::date AS day, count(a.id)::int AS attempts, count(a.id) FILTER (WHERE a.status = 'PASSED')::int AS passed,
                count(DISTINCT a.student_id)::int AS "activeStudents"
           FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') d
           LEFT JOIN level_attempts a ON a.started_at >= d AND a.started_at < d + interval '1 day'
          GROUP BY d ORDER BY d`,
        [days],
      ),
      db.query(
        `SELECT s.stars, count(p.id)::int AS levels
           FROM generate_series(0, 5) s(stars)
           LEFT JOIN student_level_progress p ON p.status = 'COMPLETED' AND p.best_stars = s.stars
          GROUP BY s.stars ORDER BY s.stars`,
      ),
    ]);
    return { totals: totals[0], levels, worlds, daily, starDistribution: stars };
  });

  // ── attempts (all students) ────────────────────────────────────────────
  app.get('/api/admin/attempts', can('progress.view'), async (req) => {
    const query = Pagination.extend({
      studentId: z.uuid().optional(),
      levelId: z.uuid().optional(),
      programId: z.uuid().optional(),
      status: z.enum(['RUNNING', 'PASSED', 'FAILED', 'ERROR', 'ABORTED']).optional(),
      search: z.string().trim().max(64).optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    })
      .strict()
      .parse(req.query);
    const search = query.search ? `%${likeEscape(query.search.toLowerCase())}%` : null;
    const where = `($1::uuid IS NULL OR a.student_id = $1) AND ($2::uuid IS NULL OR a.level_id = $2) AND ($3::attempt_status IS NULL OR a.status = $3::attempt_status)
      AND ($4::text IS NULL OR u.username_normalized LIKE $4 OR lower(u.display_name) LIKE $4)
      AND ($5::date IS NULL OR a.started_at >= $5::date) AND ($6::date IS NULL OR a.started_at < $6::date + 1)
      AND ($7::uuid IS NULL OR a.program_id = $7)`;
    const params = [query.studentId ?? null, query.levelId ?? null, query.status ?? null, search, query.from ?? null, query.to ?? null, query.programId ?? null];
    const [{ rows }, { rows: total }] = await Promise.all([
      db.query(`SELECT ${ATTEMPT_FIELDS} FROM ${ATTEMPT_FROM} WHERE ${where} ORDER BY a.started_at DESC, a.attempt_number DESC LIMIT $8 OFFSET $9`, [
        ...params,
        query.pageSize,
        (query.page - 1) * query.pageSize,
      ]),
      db.query<{ n: number }>(`SELECT count(*) AS n FROM ${ATTEMPT_FROM} WHERE ${where}`, params),
    ]);
    return { attempts: rows, page: query.page, pageSize: query.pageSize, total: total[0]?.n ?? 0 };
  });

  /** One attempt with the exact program version that ran and the level's objectives. */
  app.get('/api/admin/attempts/:id', can('progress.view'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    const { rows } = await db.query<{ levelId: string; programVersionId: string | null }>(
      `SELECT ${ATTEMPT_FIELDS}, a.result, l.max_stars AS "maxStars" FROM ${ATTEMPT_FROM} WHERE a.id = $1`,
      [id],
    );
    const attempt = rows[0];
    if (!attempt) throw notFound('Attempt');
    const [{ rows: versions }, { rows: objectives }] = await Promise.all([
      attempt.programVersionId
        ? db.query(
            `SELECT id, version_number AS "versionNumber", source, block_program AS "blockProgram", python_code AS "pythonCode", created_at AS "createdAt"
               FROM program_versions WHERE id = $1`,
            [attempt.programVersionId],
          )
        : Promise.resolve({ rows: [] as unknown[], rowCount: 0 }),
      db.query(
        `SELECT code, title, objective_type AS type, required FROM level_objectives WHERE level_id = $1 AND deleted_at IS NULL ORDER BY sort_order`,
        [attempt.levelId],
      ),
    ]);
    return { attempt, programVersion: versions[0] ?? null, objectives };
  });

  // ── programs (all students) ────────────────────────────────────────────
  app.get('/api/admin/programs', can('progress.view'), async (req) => {
    const query = Pagination.extend({
      studentId: z.uuid().optional(),
      levelId: z.uuid().optional(),
      search: z.string().trim().max(64).optional(),
      submitted: z.enum(['true', 'false']).optional(),
    })
      .strict()
      .parse(req.query);
    const search = query.search ? `%${likeEscape(query.search.toLowerCase())}%` : null;
    const where = `p.deleted_at IS NULL AND ($1::uuid IS NULL OR p.student_id = $1) AND ($2::uuid IS NULL OR p.level_id = $2)
      AND ($3::text IS NULL OR u.username_normalized LIKE $3 OR lower(u.display_name) LIKE $3 OR lower(l.title) LIKE $3)
      AND ($4::boolean IS NULL OR p.is_submitted = $4)`;
    const params = [query.studentId ?? null, query.levelId ?? null, search, query.submitted === undefined ? null : query.submitted === 'true'];
    const from = `programs p JOIN users u ON u.id = p.student_id JOIN levels l ON l.id = p.level_id JOIN worlds w ON w.id = l.world_id`;
    const [{ rows }, { rows: total }] = await Promise.all([
      db.query(
        `SELECT p.id, p.student_id AS "studentId", u.username, u.display_name AS "studentName", p.level_id AS "levelId", l.slug AS "levelSlug",
                l.title AS "levelTitle", w.name AS "worldName", p.name, p.version, p.is_submitted AS "isSubmitted", p.updated_at AS "updatedAt",
                (SELECT count(*) FROM level_attempts a WHERE a.program_id = p.id)::int AS attempts,
                (SELECT a.status FROM level_attempts a WHERE a.program_id = p.id ORDER BY a.started_at DESC LIMIT 1) AS "lastAttemptStatus"
           FROM ${from} WHERE ${where} ORDER BY p.updated_at DESC LIMIT $5 OFFSET $6`,
        [...params, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      db.query<{ n: number }>(`SELECT count(*) AS n FROM ${from} WHERE ${where}`, params),
    ]);
    return { programs: rows, page: query.page, pageSize: query.pageSize, total: total[0]?.n ?? 0 };
  });
}
