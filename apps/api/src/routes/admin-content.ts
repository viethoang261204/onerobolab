import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { currentUser } from '../auth/guard.ts';
import { BLOCK_TYPES } from '../domain/program.ts';
import { audit } from '../http/audit.ts';
import { insertRow, patchRow, selectOne } from '../http/crud.ts';
import { jsonObject, Pagination, Slug, UuidParam, type ColumnSpec } from '../http/sql.ts';


// ── lessons ──────────────────────────────────────────────────────────────
const LessonFields = z.object({
  curriculumId: z.uuid(),
  worldId: z.uuid().nullable(),
  levelId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(160),
  slug: Slug,
  description: z.string().max(2000).nullable(),
  contentType: z.enum(['TEXT', 'MARKDOWN', 'VIDEO', 'IMAGE', 'INTERACTIVE']),
  /** {"markdown": "..."} · {"text": "..."} · {"url": "..."} · {"widget": "..."}. */
  content: jsonObject(100_000),
  sortOrder: z.number().int().min(-100_000).max(100_000),
});
const LESSON_COLS: Record<string, ColumnSpec> = {
  curriculumId: { col: 'curriculum_id', cast: 'uuid' }, worldId: { col: 'world_id', cast: 'uuid' }, levelId: { col: 'level_id', cast: 'uuid' },
  title: { col: 'title' }, slug: { col: 'slug' }, description: { col: 'description' }, contentType: { col: 'content_type', cast: 'lesson_content_type' },
  content: { col: 'content', cast: 'jsonb', json: true }, sortOrder: { col: 'sort_order' },
};
const LESSON_SELECT = `SELECT ls.id, ls.curriculum_id AS "curriculumId", ls.world_id AS "worldId", ls.level_id AS "levelId", ls.title, ls.slug, ls.description,
  ls.content_type AS "contentType", ls.content, ls.sort_order AS "sortOrder", ls.status, ls.created_at AS "createdAt", ls.updated_at AS "updatedAt",
  (SELECT c.name FROM curricula c WHERE c.id = ls.curriculum_id) AS "curriculumName",
  (SELECT w.name FROM worlds w WHERE w.id = ls.world_id) AS "worldName",
  (SELECT l.title FROM levels l WHERE l.id = ls.level_id) AS "levelTitle"
  FROM lessons ls WHERE ls.deleted_at IS NULL`;

// ── achievements ─────────────────────────────────────────────────────────
/** The rule types the server knows how to evaluate (domain/rewards.ts). */
const Criteria = z.discriminatedUnion('type', [
  z.object({ type: z.literal('complete_levels'), count: z.number().int().min(1).max(10_000) }).strict(),
  z.object({ type: z.literal('complete_level'), level: Slug }).strict(),
  z.object({ type: z.literal('complete_world'), world: Slug }).strict(),
  z.object({ type: z.literal('total_stars'), count: z.number().int().min(1).max(100_000) }).strict(),
  z.object({ type: z.literal('three_star_levels'), count: z.number().int().min(1).max(10_000) }).strict(),
  z.object({ type: z.literal('streak_days'), count: z.number().int().min(1).max(3650) }).strict(),
  z.object({ type: z.literal('use_block'), block: z.enum(BLOCK_TYPES), inPassedSubmission: z.boolean().optional() }).strict(),
]);
const AchievementFields = z.object({
  name: z.string().trim().min(1).max(120),
  slug: Slug,
  description: z.string().trim().min(1).max(1000),
  icon: z.string().trim().max(80).nullable(),
  xpReward: z.number().int().min(0).max(100_000),
  criteria: Criteria,
  isSecret: z.boolean(),
  sortOrder: z.number().int().min(-100_000).max(100_000),
});
const ACHIEVEMENT_COLS: Record<string, ColumnSpec> = {
  name: { col: 'name' }, slug: { col: 'slug' }, description: { col: 'description' }, icon: { col: 'icon' }, xpReward: { col: 'xp_reward' },
  criteria: { col: 'criteria', cast: 'jsonb', json: true }, isSecret: { col: 'is_secret' }, sortOrder: { col: 'sort_order' },
};
const ACHIEVEMENT_SELECT = `SELECT a.id, a.name, a.slug, a.description, a.icon, a.xp_reward AS "xpReward", a.criteria, a.is_secret AS "isSecret",
  a.sort_order AS "sortOrder", a.status, a.created_at AS "createdAt", a.updated_at AS "updatedAt",
  (SELECT count(*) FROM student_achievements sa WHERE sa.achievement_id = a.id)::int AS "unlockedBy"
  FROM achievements a WHERE a.deleted_at IS NULL`;

export function registerAdminContentRoutes(app: FastifyInstance, { db, permissions }: AppDeps) {
  const can = (permission: string) => ({ preHandler: permissions.require(permission) });

  // ── lessons ────────────────────────────────────────────────────────────
  app.get('/api/admin/lessons', can('content.manage'), async (req) => {
    const query = z.object({ curriculumId: z.uuid().optional(), worldId: z.uuid().optional(), levelId: z.uuid().optional() }).strict().parse(req.query);
    const { rows } = await db.query(
      `${LESSON_SELECT} AND ($1::uuid IS NULL OR ls.curriculum_id = $1) AND ($2::uuid IS NULL OR ls.world_id = $2) AND ($3::uuid IS NULL OR ls.level_id = $3)
       ORDER BY ls.sort_order, ls.title`,
      [query.curriculumId ?? null, query.worldId ?? null, query.levelId ?? null],
    );
    return { lessons: rows };
  });

  app.post('/api/admin/lessons', can('content.manage'), async (req, reply) => {
    const body = LessonFields.partial({ worldId: true, levelId: true, description: true, content: true, sortOrder: true }).strict().parse(req.body);
    // Hierarchy (world ∈ curriculum, level ∈ world) is enforced by a trigger → 422.
    const lesson = await db.tx(async (q) => {
      const id = await insertRow(q, 'lessons', LESSON_COLS, body, { created_by: currentUser(req).id });
      const row = await selectOne(q, LESSON_SELECT, 'ls', id, 'Lesson');
      await audit(q, req, { action: 'CREATE_LESSON', entityType: 'lesson', entityId: id, newData: row });
      return row;
    });
    return reply.status(201).send({ lesson });
  });

  app.patch('/api/admin/lessons/:id', can('content.manage'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = LessonFields.partial().strict().parse(req.body);
    return db.tx(async (q) => {
      const before = await selectOne(q, LESSON_SELECT, 'ls', id, 'Lesson', true);
      await patchRow(q, 'lessons', LESSON_COLS, id, body);
      const after = await selectOne(q, LESSON_SELECT, 'ls', id, 'Lesson');
      await audit(q, req, { action: 'UPDATE_LESSON', entityType: 'lesson', entityId: id, oldData: before, newData: after });
      return { lesson: after };
    });
  });

  app.delete('/api/admin/lessons/:id', can('content.manage'), async (req, reply) => {
    const { id } = UuidParam.parse(req.params);
    await db.tx(async (q) => {
      const before = await selectOne(q, LESSON_SELECT, 'ls', id, 'Lesson', true);
      await q.query('UPDATE lessons SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      await audit(q, req, { action: 'DELETE_LESSON', entityType: 'lesson', entityId: id, oldData: before });
    });
    return reply.status(204).send();
  });

  // ── achievements ───────────────────────────────────────────────────────
  app.get('/api/admin/achievements', can('achievements.manage'), async () => {
    const { rows } = await db.query(`${ACHIEVEMENT_SELECT} ORDER BY a.sort_order, a.name`);
    return { achievements: rows };
  });

  app.post('/api/admin/achievements', can('achievements.manage'), async (req, reply) => {
    const body = AchievementFields.partial({ icon: true, xpReward: true, isSecret: true, sortOrder: true }).strict().parse(req.body);
    const achievement = await db.tx(async (q) => {
      const id = await insertRow(q, 'achievements', ACHIEVEMENT_COLS, body);
      const row = await selectOne(q, ACHIEVEMENT_SELECT, 'a', id, 'Achievement');
      await audit(q, req, { action: 'CREATE_ACHIEVEMENT', entityType: 'achievement', entityId: id, newData: row });
      return row;
    });
    return reply.status(201).send({ achievement });
  });

  app.patch('/api/admin/achievements/:id', can('achievements.manage'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = AchievementFields.partial().strict().parse(req.body);
    return db.tx(async (q) => {
      const before = await selectOne(q, ACHIEVEMENT_SELECT, 'a', id, 'Achievement', true);
      await patchRow(q, 'achievements', ACHIEVEMENT_COLS, id, body);
      const after = await selectOne(q, ACHIEVEMENT_SELECT, 'a', id, 'Achievement');
      await audit(q, req, { action: 'UPDATE_ACHIEVEMENT', entityType: 'achievement', entityId: id, oldData: before, newData: after });
      return { achievement: after };
    });
  });

  /** Soft delete: students keep achievements they already earned. */
  app.delete('/api/admin/achievements/:id', can('achievements.manage'), async (req, reply) => {
    const { id } = UuidParam.parse(req.params);
    await db.tx(async (q) => {
      const before = await selectOne(q, ACHIEVEMENT_SELECT, 'a', id, 'Achievement', true);
      await q.query('UPDATE achievements SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      await audit(q, req, { action: 'DELETE_ACHIEVEMENT', entityType: 'achievement', entityId: id, oldData: before });
    });
    return reply.status(204).send();
  });

  // ── audit log ──────────────────────────────────────────────────────────
  app.get('/api/admin/audit-logs', can('audit.view'), async (req) => {
    const query = Pagination.extend({
      action: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/).optional(),
      entityType: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).optional(),
      entityId: z.string().max(100).optional(),
      adminId: z.uuid().optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    })
      .strict()
      .parse(req.query);
    const where = `($1::text IS NULL OR l.action = $1) AND ($2::text IS NULL OR l.entity_type = $2)
          AND ($3::text IS NULL OR l.entity_id = $3) AND ($4::uuid IS NULL OR l.admin_id = $4)
          AND ($5::date IS NULL OR l.created_at >= $5::date) AND ($6::date IS NULL OR l.created_at < $6::date + 1)`;
    const params = [query.action ?? null, query.entityType ?? null, query.entityId ?? null, query.adminId ?? null, query.from ?? null, query.to ?? null];
    const [{ rows }, { rows: total }] = await Promise.all([
      db.query(
        `SELECT l.id, l.action, l.entity_type AS "entityType", l.entity_id AS "entityId", l.admin_id AS "adminId",
                u.username AS "adminUsername", u.display_name AS "adminName",
                l.old_data AS "oldData", l.new_data AS "newData", l.ip_address::text AS "ipAddress", l.request_id AS "requestId", l.created_at AS "createdAt",
                -- Human-readable subject, resolved now (names may have changed since).
                CASE l.entity_type
                  WHEN 'user' THEN (SELECT x.display_name FROM users x WHERE x.id::text = l.entity_id)
                  WHEN 'student_level_access' THEN (SELECT x.display_name FROM users x WHERE x.id::text = split_part(l.entity_id, ':', 1))
                END AS "studentName",
                CASE l.entity_type
                  WHEN 'level' THEN (SELECT x.title FROM levels x WHERE x.id::text = l.entity_id)
                  WHEN 'student_level_access' THEN (SELECT x.title FROM levels x WHERE x.id::text = split_part(l.entity_id, ':', 2))
                END AS "levelTitle",
                CASE l.entity_type
                  WHEN 'curriculum' THEN (SELECT x.name FROM curricula x WHERE x.id::text = l.entity_id)
                  WHEN 'world' THEN (SELECT x.name FROM worlds x WHERE x.id::text = l.entity_id)
                  WHEN 'lesson' THEN (SELECT x.title FROM lessons x WHERE x.id::text = l.entity_id)
                  WHEN 'achievement' THEN (SELECT x.name FROM achievements x WHERE x.id::text = l.entity_id)
                  WHEN 'level_objective' THEN (SELECT x.title FROM level_objectives x WHERE x.id::text = l.entity_id)
                  WHEN 'level_hint' THEN (SELECT x.title FROM level_hints x WHERE x.id::text = l.entity_id)
                  WHEN 'level_checkpoint' THEN (SELECT x.name FROM level_checkpoints x WHERE x.id::text = l.entity_id)
                END AS "entityName"
           FROM audit_logs l LEFT JOIN users u ON u.id = l.admin_id
          WHERE ${where}
          ORDER BY l.created_at DESC, l.id LIMIT $7 OFFSET $8`,
        [...params, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      db.query<{ n: number }>(`SELECT count(*) AS n FROM audit_logs l WHERE ${where}`, params),
    ]);
    return { logs: rows, page: query.page, pageSize: query.pageSize, total: total[0]?.n ?? 0 };
  });
}
