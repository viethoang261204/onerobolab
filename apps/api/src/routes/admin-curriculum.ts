import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { currentUser } from '../auth/guard.ts';
import type { Queryable } from '../db/db.ts';
import { Point, prerequisitesFor, publishProblems } from '../domain/level-readiness.ts';
import { BLOCK_TYPES } from '../domain/program.ts';
import { CONTENT_STATUSES } from '../domain/workflow.ts';
import { audit, type AuditAction } from '../http/audit.ts';
import { conflict, forbidden, notFound, unprocessable } from '../http/errors.ts';
import { insertRow, patchRow, selectOne } from '../http/crud.ts';
import { jsonObject, likeEscape, Pagination, Slug, UuidParam, type ColumnSpec } from '../http/sql.ts';

// ── shared field schemas ─────────────────────────────────────────────────
const Name = z.string().trim().min(1).max(120);
const Text = (max: number) => z.string().max(max).nullable();
const Url = z.string().trim().max(2048).nullable();
/** Status filter only — status changes go through the workflow endpoints (admin-workflow.ts). */
const Status = z.enum(CONTENT_STATUSES);
const Difficulty = z.enum(['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT']);
const Theme = z.string().regex(/^[a-z0-9-]{2,40}$/);
const EnvironmentId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const Code = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const SortOrder = z.number().int().min(-100_000).max(100_000);

/** Map data the frontend renders; start/finish (when present) must be real points — the scorer relies on them. */
const MapDefinition = jsonObject(200_000).superRefine((m, ctx) => {
  if ('start' in m && !Point.safeParse(m.start).success) ctx.addIssue({ code: 'custom', message: 'start must be {x, z}.', path: ['start'] });
  const finish = m.finish as { center?: unknown } | undefined;
  if (finish !== undefined && !Point.safeParse(finish?.center).success) ctx.addIssue({ code: 'custom', message: 'finish.center must be {x, z}.', path: ['finish'] });
});
const MissionSettings = z
  .object({ failOnCollision: z.boolean().optional(), timeLimit: z.number().positive().max(3600).nullable().optional() })
  .catchall(z.unknown())
  .refine((v) => Buffer.byteLength(JSON.stringify(v)) <= 20_000, 'mission settings too large.');

// ── curricula ────────────────────────────────────────────────────────────
const CurriculumFields = z.object({
  name: Name,
  slug: Slug,
  description: Text(4000),
  thumbnail: Url,
  sortOrder: SortOrder,
});
const CURRICULUM_COLS: Record<string, ColumnSpec> = {
  name: { col: 'name' }, slug: { col: 'slug' }, description: { col: 'description' }, thumbnail: { col: 'thumbnail' },
  sortOrder: { col: 'sort_order' },
};
const CURRICULUM_SELECT = `SELECT c.id, c.name, c.slug, c.description, c.thumbnail, c.status, c.sort_order AS "sortOrder", c.created_at AS "createdAt", c.updated_at AS "updatedAt",
  (SELECT count(*) FROM worlds w WHERE w.curriculum_id = c.id AND w.deleted_at IS NULL)::int AS "worldCount"
  FROM curricula c WHERE c.deleted_at IS NULL`;

// ── worlds ───────────────────────────────────────────────────────────────
const WorldFields = z.object({
  curriculumId: z.uuid(),
  name: Name,
  slug: Slug,
  shortDescription: Text(160),
  description: Text(4000),
  theme: Theme,
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  difficulty: Difficulty,
  thumbnail: Url,
  mapPreview: Url,
  environmentId: EnvironmentId.nullable(),
  mapPosition: jsonObject(2_000).nullable(),
  sortOrder: SortOrder,
  isVisible: z.boolean(),
});
const WORLD_COLS: Record<string, ColumnSpec> = {
  curriculumId: { col: 'curriculum_id', cast: 'uuid' }, name: { col: 'name' }, slug: { col: 'slug' }, shortDescription: { col: 'short_description' },
  description: { col: 'description' }, theme: { col: 'theme' }, accentColor: { col: 'accent_color' }, skills: { col: 'skills', cast: 'text[]' },
  difficulty: { col: 'difficulty', cast: 'level_difficulty' }, thumbnail: { col: 'thumbnail' }, mapPreview: { col: 'map_preview' },
  environmentId: { col: 'environment_id' }, mapPosition: { col: 'map_position', cast: 'jsonb', json: true }, sortOrder: { col: 'sort_order' },
  isVisible: { col: 'is_visible' },
};
const WORLD_SELECT = `SELECT w.id, w.curriculum_id AS "curriculumId", w.name, w.slug, w.short_description AS "shortDescription", w.description, w.theme,
  w.accent_color AS "accentColor", w.skills, w.difficulty, w.thumbnail, w.map_preview AS "mapPreview", w.environment_id AS "environmentId",
  w.map_position AS "mapPosition", w.sort_order AS "sortOrder", w.status, w.is_visible AS "isVisible", w.created_at AS "createdAt", w.updated_at AS "updatedAt",
  (SELECT count(*) FROM levels l WHERE l.world_id = w.id AND l.deleted_at IS NULL)::int AS "levelCount"
  FROM worlds w WHERE w.deleted_at IS NULL`;

// ── levels ───────────────────────────────────────────────────────────────
const LevelFields = z.object({
  worldId: z.uuid(),
  slug: Slug,
  title: Name,
  briefDescription: Text(200),
  description: Text(8000),
  difficulty: Difficulty,
  sortOrder: SortOrder,
  visibility: z.enum(['VISIBLE', 'HIDDEN']),
  accessMode: z.enum(['AUTO', 'UNLOCKED', 'LOCKED']),
  thumbnail: Url,
  previewImage: Url,
  environmentId: EnvironmentId,
  estimatedMinutes: z.number().int().min(1).max(600).nullable(),
  xpReward: z.number().int().min(0).max(10_000),
  maxStars: z.number().int().min(0).max(5),
  parBlocks: z.number().int().min(1).max(500).nullable(),
  parSeconds: z.number().positive().max(3600).nullable(),
  /** null = every block type. */
  allowedBlocks: z.array(z.enum(BLOCK_TYPES)).max(BLOCK_TYPES.length).nullable(),
  introSteps: z.array(z.string().trim().min(1).max(500)).max(20),
  mapDefinition: MapDefinition,
  sceneConfig: jsonObject(50_000),
  missionSettings: MissionSettings,
});
const LEVEL_COLS: Record<string, ColumnSpec> = {
  worldId: { col: 'world_id', cast: 'uuid' }, slug: { col: 'slug' }, title: { col: 'title' }, briefDescription: { col: 'brief_description' },
  description: { col: 'description' }, difficulty: { col: 'difficulty', cast: 'level_difficulty' }, sortOrder: { col: 'sort_order' },
  visibility: { col: 'visibility', cast: 'level_visibility' }, accessMode: { col: 'access_mode', cast: 'level_access_mode' },
  thumbnail: { col: 'thumbnail' }, previewImage: { col: 'preview_image' }, environmentId: { col: 'environment_id' },
  estimatedMinutes: { col: 'estimated_minutes' }, xpReward: { col: 'xp_reward' }, maxStars: { col: 'max_stars' }, parBlocks: { col: 'par_blocks' },
  parSeconds: { col: 'par_seconds' }, allowedBlocks: { col: 'allowed_blocks', cast: 'text[]' }, introSteps: { col: 'intro_steps', cast: 'text[]' },
  mapDefinition: { col: 'map_definition', cast: 'jsonb', json: true }, sceneConfig: { col: 'scene_config', cast: 'jsonb', json: true },
  missionSettings: { col: 'mission_settings', cast: 'jsonb', json: true },
};
/** Fields whose change alters how the level plays (bumps content_version). */
const GAMEPLAY_FIELDS = ['mapDefinition', 'sceneConfig', 'missionSettings', 'allowedBlocks', 'parBlocks', 'parSeconds', 'maxStars', 'environmentId'];
/** Fields that need `levels.publish` (hide / lock for everyone). */
const PUBLISH_FIELDS = ['visibility', 'accessMode'];

const LEVEL_SELECT = `SELECT l.id, l.world_id AS "worldId", w.slug AS "worldSlug", l.slug, l.title, l.brief_description AS "briefDescription", l.description,
  l.difficulty, l.sort_order AS "sortOrder", l.status, l.visibility, l.access_mode AS "accessMode", l.thumbnail, l.preview_image AS "previewImage",
  l.environment_id AS "environmentId", l.estimated_minutes AS "estimatedMinutes", l.xp_reward AS "xpReward", l.max_stars AS "maxStars",
  l.par_blocks AS "parBlocks", l.par_seconds AS "parSeconds", l.allowed_blocks AS "allowedBlocks", l.intro_steps AS "introSteps",
  l.map_definition AS "mapDefinition", l.scene_config AS "sceneConfig", l.mission_settings AS "missionSettings",
  l.content_version AS "contentVersion", l.published_at AS "publishedAt", l.created_at AS "createdAt", l.updated_at AS "updatedAt"
  FROM levels l JOIN worlds w ON w.id = l.world_id WHERE l.deleted_at IS NULL`;

// ── level content ────────────────────────────────────────────────────────
const CheckpointFields = z.object({
  code: Code,
  name: z.string().trim().min(1).max(120),
  description: Text(1000),
  sortOrder: z.number().int().min(1).max(1000),
  position: Point.refine((p) => Buffer.byteLength(JSON.stringify(p)) <= 500, 'position too large.'),
  radius: z.number().positive().max(10),
  required: z.boolean(),
});
const CHECKPOINT_COLS: Record<string, ColumnSpec> = {
  code: { col: 'code' }, name: { col: 'name' }, description: { col: 'description' }, sortOrder: { col: 'sort_order' },
  position: { col: 'position', cast: 'jsonb', json: true }, radius: { col: 'radius' }, required: { col: 'required' },
};
const CHECKPOINT_SELECT = `SELECT c.id, c.level_id AS "levelId", c.code, c.name, c.description, c.sort_order AS "sortOrder", c.position, c.radius, c.required
  FROM level_checkpoints c WHERE c.deleted_at IS NULL`;

const ObjectiveFields = z.object({
  code: Code,
  title: z.string().trim().min(1).max(160),
  description: Text(1000),
  type: z.enum(['START_PROGRAM', 'REACH_CHECKPOINT', 'REACH_ALL_CHECKPOINTS', 'REACH_GOAL', 'AVOID_COLLISIONS', 'FINISH_WITHIN', 'USE_MAX_BLOCKS', 'CUSTOM']),
  /** Required for (and only for) REACH_CHECKPOINT. */
  checkpointId: z.uuid().nullable(),
  config: jsonObject(4_000),
  sortOrder: SortOrder,
  required: z.boolean(),
});
const OBJECTIVE_COLS: Record<string, ColumnSpec> = {
  code: { col: 'code' }, title: { col: 'title' }, description: { col: 'description' }, type: { col: 'objective_type', cast: 'objective_type' },
  checkpointId: { col: 'checkpoint_id', cast: 'uuid' }, config: { col: 'config', cast: 'jsonb', json: true }, sortOrder: { col: 'sort_order' },
  required: { col: 'required' },
};
const OBJECTIVE_SELECT = `SELECT o.id, o.level_id AS "levelId", o.code, o.title, o.description, o.objective_type AS "type", o.checkpoint_id AS "checkpointId",
  o.config, o.sort_order AS "sortOrder", o.required FROM level_objectives o WHERE o.deleted_at IS NULL`;

const HintFields = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(4000),
  cost: z.number().int().min(0).max(1000),
  sortOrder: z.number().int().min(1).max(1000),
});
const HINT_COLS: Record<string, ColumnSpec> = { title: { col: 'title' }, content: { col: 'content' }, cost: { col: 'cost' }, sortOrder: { col: 'sort_order' } };
const HINT_SELECT = `SELECT h.id, h.level_id AS "levelId", h.title, h.content, h.cost, h.sort_order AS "sortOrder" FROM level_hints h WHERE h.deleted_at IS NULL`;

const Requirement = z.discriminatedUnion('type', [
  z.object({ type: z.literal('LEVEL_COMPLETED'), levelId: z.uuid() }).strict(),
  z.object({ type: z.literal('LEVEL_STARS'), levelId: z.uuid(), stars: z.number().int().min(0).max(5) }).strict(),
  z.object({ type: z.literal('WORLD_COMPLETED'), worldId: z.uuid() }).strict(),
  z.object({ type: z.literal('TOTAL_STARS'), stars: z.number().int().min(0).max(100_000) }).strict(),
  z.object({ type: z.literal('TOTAL_XP'), xp: z.number().int().min(0).max(10_000_000) }).strict(),
  z.object({ type: z.literal('ACHIEVEMENT'), achievementId: z.uuid() }).strict(),
]);
const PrerequisitesBody = z
  .object({
    /** Groups are OR-ed; the requirements inside a group are AND-ed. Empty = always available (AUTO mode). */
    groups: z.array(z.object({ name: z.string().trim().max(120).nullable().optional(), requirements: z.array(Requirement).min(1).max(20) }).strict()).max(10),
  })
  .strict();

// ── helpers ──────────────────────────────────────────────────────────────
async function assertLevel(q: Queryable, levelId: string) {
  const { rows } = await q.query<{ id: string }>('SELECT id FROM levels WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [levelId]);
  if (!rows[0]) throw notFound('Level');
}

async function bumpContentVersion(q: Queryable, levelId: string) {
  await q.query('UPDATE levels SET content_version = content_version + 1 WHERE id = $1', [levelId]);
}

/** REACH_CHECKPOINT ⇔ checkpointId, and the checkpoint must belong to the same level. */
async function checkObjectiveCheckpoint(q: Queryable, levelId: string, type: string, checkpointId: string | null) {
  if ((type === 'REACH_CHECKPOINT') !== (checkpointId !== null)) {
    throw unprocessable('INVALID_OBJECTIVE', 'REACH_CHECKPOINT objectives need a checkpointId; other types must not have one.');
  }
  if (checkpointId) {
    const { rows } = await q.query('SELECT 1 FROM level_checkpoints WHERE id = $1 AND level_id = $2 AND deleted_at IS NULL', [checkpointId, levelId]);
    if (!rows[0]) throw unprocessable('INVALID_REFERENCE', 'The checkpoint does not belong to this level.');
  }
}

/**
 * Would these requirements make `levelId` (transitively) require itself?
 * Edges: level → prerequisite level, and level → every level of a required world.
 */
async function createsCycle(q: Queryable, levelId: string, requirements: z.infer<typeof Requirement>[]): Promise<boolean> {
  const { rows } = await q.query<{ from: string; to: string }>(
    `SELECT p.level_id AS "from", p.prerequisite_level_id AS "to" FROM level_prerequisites p
      WHERE p.prerequisite_level_id IS NOT NULL AND p.level_id <> $1
     UNION ALL
     SELECT p.level_id, l.id FROM level_prerequisites p JOIN levels l ON l.world_id = p.prerequisite_world_id AND l.deleted_at IS NULL
      WHERE p.prerequisite_world_id IS NOT NULL AND p.level_id <> $1`,
    [levelId],
  );
  const edges = new Map<string, string[]>();
  const add = (from: string, to: string) => edges.set(from, [...(edges.get(from) ?? []), to]);
  for (const r of rows) add(r.from, r.to);
  const worldIds = requirements.flatMap((r) => (r.type === 'WORLD_COMPLETED' ? [r.worldId] : []));
  if (worldIds.length) {
    const { rows: wl } = await q.query<{ id: string }>('SELECT id FROM levels WHERE world_id = ANY($1::uuid[]) AND deleted_at IS NULL', [worldIds]);
    for (const l of wl) add(levelId, l.id);
  }
  for (const r of requirements) if (r.type === 'LEVEL_COMPLETED' || r.type === 'LEVEL_STARS') add(levelId, r.levelId);

  const seen = new Set<string>();
  const stack = [...(edges.get(levelId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === levelId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(edges.get(id) ?? []));
  }
  return false;
}

async function readPrerequisites(q: Queryable, levelId: string) {
  return (await prerequisitesFor(q, [levelId])).get(levelId) ?? [];
}

/** Next free sort position among a level's children (hints / checkpoints need unique positions). */
async function nextSortOrder(q: Queryable, table: 'level_hints' | 'level_checkpoints' | 'level_objectives', levelId: string): Promise<number> {
  const { rows } = await q.query<{ n: number }>(`SELECT COALESCE(max(sort_order), 0) + 1 AS n FROM ${table} WHERE level_id = $1 AND deleted_at IS NULL`, [levelId]);
  return rows[0]!.n;
}

export function registerAdminCurriculumRoutes(app: FastifyInstance, { db, permissions }: AppDeps) {
  const can = (permission: string) => ({ preHandler: permissions.require(permission) });
  const manage = can('curriculum.manage');
  const hasPermission = async (req: FastifyRequest, p: string) => (await permissions.forRole(currentUser(req).role)).has(p);

  /** Generic child-entity (checkpoint / objective / hint) update + delete inside a transaction with audit. */
  const auditUpdate = (req: FastifyRequest, q: Queryable, action: AuditAction, entityType: string, id: string, oldData: unknown, newData: unknown) =>
    audit(q, req, { action, entityType, entityId: id, oldData, newData });

  // ── environments (read-only list for pickers) ──────────────────────────
  app.get('/api/admin/environments', manage, async () => {
    const { rows } = await db.query(
      `SELECT id, name, kind, theme, description, status FROM environments WHERE deleted_at IS NULL ORDER BY kind, name`,
    );
    return { environments: rows };
  });

  // ── curricula ──────────────────────────────────────────────────────────
  app.get('/api/admin/curriculums', manage, async () => {
    const { rows } = await db.query(`${CURRICULUM_SELECT} ORDER BY c.sort_order, c.name`);
    return { curriculums: rows };
  });

  app.post('/api/admin/curriculums', manage, async (req, reply) => {
    const body = CurriculumFields.partial({ description: true, thumbnail: true, sortOrder: true }).strict().parse(req.body);
    const curriculum = await db.tx(async (q) => {
      const id = await insertRow(q, 'curricula', CURRICULUM_COLS, body, { created_by: currentUser(req).id });
      const row = await selectOne(q, CURRICULUM_SELECT, 'c', id, 'Curriculum');
      await audit(q, req, { action: 'CREATE_CURRICULUM', entityType: 'curriculum', entityId: id, newData: row });
      return row;
    });
    return reply.status(201).send({ curriculum });
  });

  app.patch('/api/admin/curriculums/:id', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = CurriculumFields.partial().strict().parse(req.body);
    return db.tx(async (q) => {
      const before = await selectOne(q, CURRICULUM_SELECT, 'c', id, 'Curriculum', true);
      await patchRow(q, 'curricula', CURRICULUM_COLS, id, body);
      const after = await selectOne(q, CURRICULUM_SELECT, 'c', id, 'Curriculum');
      await audit(q, req, { action: 'UPDATE_CURRICULUM', entityType: 'curriculum', entityId: id, oldData: before, newData: after });
      return { curriculum: after };
    });
  });

  // ── worlds ─────────────────────────────────────────────────────────────
  app.get('/api/admin/worlds', manage, async (req) => {
    const query = z.object({ curriculumId: z.uuid().optional() }).strict().parse(req.query);
    const { rows } = await db.query(`${WORLD_SELECT} AND ($1::uuid IS NULL OR w.curriculum_id = $1) ORDER BY w.sort_order, w.name`, [query.curriculumId ?? null]);
    return { worlds: rows };
  });

  app.get('/api/admin/worlds/:id', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    return { world: await selectOne(db, WORLD_SELECT, 'w', id, 'World') };
  });

  app.post('/api/admin/worlds', manage, async (req, reply) => {
    const body = WorldFields.partial()
      .required({ curriculumId: true, name: true, slug: true, theme: true })
      .strict()
      .parse(req.body);
    const world = await db.tx(async (q) => {
      const id = await insertRow(q, 'worlds', WORLD_COLS, body, { created_by: currentUser(req).id });
      const row = await selectOne(q, WORLD_SELECT, 'w', id, 'World');
      await audit(q, req, { action: 'CREATE_WORLD', entityType: 'world', entityId: id, newData: row });
      return row;
    });
    return reply.status(201).send({ world });
  });

  app.patch('/api/admin/worlds/:id', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = WorldFields.partial().strict().parse(req.body);
    return db.tx(async (q) => {
      const before = await selectOne(q, WORLD_SELECT, 'w', id, 'World', true);
      await patchRow(q, 'worlds', WORLD_COLS, id, body);
      const after = await selectOne(q, WORLD_SELECT, 'w', id, 'World');
      await audit(q, req, { action: 'UPDATE_WORLD', entityType: 'world', entityId: id, oldData: before, newData: after });
      return { world: after };
    });
  });

  // ── levels ─────────────────────────────────────────────────────────────
  app.get('/api/admin/levels', manage, async (req) => {
    const query = Pagination.extend({
      worldId: z.uuid().optional(),
      status: Status.optional(),
      search: z.string().trim().max(80).optional(),
    })
      .strict()
      .parse(req.query);
    const search = query.search ? `%${likeEscape(query.search.toLowerCase())}%` : null;
    const where = `AND ($1::uuid IS NULL OR l.world_id = $1) AND ($2::content_status IS NULL OR l.status = $2::content_status)
                   AND ($3::text IS NULL OR lower(l.title) LIKE $3 OR l.slug LIKE $3)`;
    const params = [query.worldId ?? null, query.status ?? null, search];
    const [{ rows }, { rows: total }] = await Promise.all([
      db.query(
        `SELECT l.id, l.world_id AS "worldId", w.slug AS "worldSlug", w.name AS "worldName", l.slug, l.title, l.difficulty, l.sort_order AS "sortOrder",
                l.status, l.visibility, l.access_mode AS "accessMode", l.environment_id AS "environmentId", l.thumbnail, l.xp_reward AS "xpReward",
                l.max_stars AS "maxStars", l.estimated_minutes AS "estimatedMinutes", l.content_version AS "contentVersion",
                l.published_at AS "publishedAt", l.updated_at AS "updatedAt",
                (SELECT count(*) FROM level_attempts a WHERE a.level_id = l.id)::int AS attempts,
                (SELECT count(*) FROM student_level_progress p WHERE p.level_id = l.id AND p.status <> 'NOT_STARTED')::int AS "studentsStarted",
                (SELECT count(*) FROM student_level_progress p WHERE p.level_id = l.id AND p.status = 'COMPLETED')::int AS "studentsCompleted"
           FROM levels l JOIN worlds w ON w.id = l.world_id JOIN curricula c ON c.id = w.curriculum_id WHERE l.deleted_at IS NULL ${where}
          ORDER BY c.sort_order, w.sort_order, l.sort_order LIMIT $4 OFFSET $5`,
        [...params, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      db.query<{ n: number }>(`SELECT count(*) AS n FROM levels l WHERE l.deleted_at IS NULL ${where}`, params),
    ]);
    const prereqs = await prerequisitesFor(db, rows.map((r) => (r as { id: string }).id));
    const levels = rows.map((r) => ({ ...r, prerequisites: prereqs.get((r as { id: string }).id) ?? [] }));
    return { levels, page: query.page, pageSize: query.pageSize, total: total[0]?.n ?? 0 };
  });

  /**
   * Every level with its unlock rules — for the dependency graph and level
   * pickers (unlock a level for a student). Not paginated: it is the map.
   */
  app.get('/api/admin/levels/graph', { preHandler: permissions.requireAny('curriculum.manage', 'levels.unlock', 'progress.view') }, async () => {
    const { rows } = await db.query<{ id: string }>(
      `SELECT l.id, l.slug, l.title, l.status, l.visibility, l.access_mode AS "accessMode", l.sort_order AS "sortOrder",
              w.id AS "worldId", w.name AS "worldName", w.slug AS "worldSlug", w.sort_order AS "worldOrder", c.id AS "curriculumId", c.name AS "curriculumName"
         FROM levels l JOIN worlds w ON w.id = l.world_id JOIN curricula c ON c.id = w.curriculum_id
        WHERE l.deleted_at IS NULL AND w.deleted_at IS NULL AND c.deleted_at IS NULL
        ORDER BY c.sort_order, w.sort_order, l.sort_order`,
    );
    const prereqs = await prerequisitesFor(db, rows.map((r) => r.id));
    return { levels: rows.map((r) => ({ ...r, prerequisites: prereqs.get(r.id) ?? [] })) };
  });

  /** Students with a manual override on this level (unlock / lock for one student). */
  app.get('/api/admin/levels/:id/access', can('levels.unlock'), async (req) => {
    const { id } = UuidParam.parse(req.params);
    await selectOne(db, LEVEL_SELECT, 'l', id, 'Level');
    const { rows } = await db.query(
      `SELECT a.student_id AS "studentId", u.username, u.display_name AS "displayName", a.status, a.override_reason AS reason,
              a.expires_at AS "expiresAt", (a.expires_at IS NOT NULL AND a.expires_at <= CURRENT_TIMESTAMP) AS expired,
              g.display_name AS "grantedBy", a.updated_at AS "updatedAt"
         FROM student_level_access a JOIN users u ON u.id = a.student_id LEFT JOIN users g ON g.id = a.granted_by
        WHERE a.level_id = $1 AND a.revoked_at IS NULL AND u.deleted_at IS NULL
        ORDER BY a.updated_at DESC`,
      [id],
    );
    return { overrides: rows };
  });

  app.get('/api/admin/levels/:id', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    const level = await selectOne(db, LEVEL_SELECT, 'l', id, 'Level');
    const [{ rows: checkpoints }, { rows: objectives }, { rows: hints }, prerequisites, problems] = await Promise.all([
      db.query(`${CHECKPOINT_SELECT} AND c.level_id = $1 ORDER BY c.sort_order`, [id]),
      db.query(`${OBJECTIVE_SELECT} AND o.level_id = $1 ORDER BY o.sort_order`, [id]),
      db.query(`${HINT_SELECT} AND h.level_id = $1 ORDER BY h.sort_order`, [id]),
      readPrerequisites(db, id),
      publishProblems(db, id),
    ]);
    return { level: { ...level, checkpoints, objectives, hints, prerequisites, publishReady: problems.length === 0, publishProblems: problems } };
  });

  app.post('/api/admin/levels', manage, async (req, reply) => {
    // New levels always start as DRAFT; publishing is a separate, audited step.
    const body = LevelFields.partial()
      .required({ worldId: true, slug: true, title: true, environmentId: true })
      .strict()
      .parse(req.body);
    if ((body.visibility !== undefined || body.accessMode !== undefined) && !(await hasPermission(req, 'levels.publish'))) throw forbidden();
    const level = await db.tx(async (q) => {
      const id = await insertRow(q, 'levels', LEVEL_COLS, body, { created_by: currentUser(req).id });
      const row = await selectOne(q, LEVEL_SELECT, 'l', id, 'Level');
      await audit(q, req, { action: 'CREATE_LEVEL', entityType: 'level', entityId: id, newData: row });
      return row;
    });
    return reply.status(201).send({ level });
  });

  app.patch('/api/admin/levels/:id', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = LevelFields.partial().strict().parse(req.body);
    if (PUBLISH_FIELDS.some((f) => f in body) && !(await hasPermission(req, 'levels.publish'))) throw forbidden();
    return db.tx(async (q) => {
      const before = await selectOne(q, LEVEL_SELECT, 'l', id, 'Level', true);
      const gameplay = GAMEPLAY_FIELDS.some((f) => f in body);
      await patchRow(q, 'levels', LEVEL_COLS, id, body, gameplay ? ['content_version = content_version + 1'] : []);
      const after = await selectOne<{ status: string }>(q, LEVEL_SELECT, 'l', id, 'Level');
      // A published level must stay playable.
      if (after.status === 'PUBLISHED') {
        const problems = await publishProblems(q, id);
        if (problems.length) throw unprocessable('LEVEL_NOT_READY', 'This change would break a published level.', problems);
      }
      await audit(q, req, { action: 'UPDATE_LEVEL', entityType: 'level', entityId: id, oldData: before, newData: after });
      return { level: after };
    });
  });

  app.delete('/api/admin/levels/:id', manage, async (req, reply) => {
    const { id } = UuidParam.parse(req.params);
    await db.tx(async (q) => {
      const before = await selectOne<{ status: string; slug: string }>(q, LEVEL_SELECT, 'l', id, 'Level', true);
      if (before.status === 'PUBLISHED') throw conflict('Unpublish the level before deleting it.', 'LEVEL_PUBLISHED');
      const { rows: deps } = await q.query('SELECT 1 FROM level_prerequisites WHERE prerequisite_level_id = $1 LIMIT 1', [id]);
      if (deps[0]) throw conflict('Other levels require this level. Update their prerequisites first.', 'IN_USE');
      // Soft delete keeps students' history; the slug is freed (unique index ignores deleted rows).
      await q.query('UPDATE levels SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      await audit(q, req, { action: 'DELETE_LEVEL', entityType: 'level', entityId: id, oldData: before });
    });
    return reply.status(204).send();
  });

  // ── checkpoints ────────────────────────────────────────────────────────
  app.post('/api/admin/levels/:id/checkpoints', manage, async (req, reply) => {
    const { id: levelId } = UuidParam.parse(req.params);
    const body = CheckpointFields.partial({ description: true, radius: true, required: true, sortOrder: true }).strict().parse(req.body);
    const checkpoint = await db.tx(async (q) => {
      await assertLevel(q, levelId);
      const sortOrder = body.sortOrder ?? (await nextSortOrder(q, 'level_checkpoints', levelId));
      const id = await insertRow(q, 'level_checkpoints', CHECKPOINT_COLS, { ...body, sortOrder }, { level_id: levelId });
      await bumpContentVersion(q, levelId);
      const row = await selectOne(q, CHECKPOINT_SELECT, 'c', id, 'Checkpoint');
      await audit(q, req, { action: 'CREATE_CHECKPOINT', entityType: 'level_checkpoint', entityId: id, newData: row });
      return row;
    });
    return reply.status(201).send({ checkpoint });
  });

  app.patch('/api/admin/checkpoints/:id', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = CheckpointFields.partial().strict().parse(req.body);
    return db.tx(async (q) => {
      const before = await selectOne<{ levelId: string }>(q, CHECKPOINT_SELECT, 'c', id, 'Checkpoint', true);
      await patchRow(q, 'level_checkpoints', CHECKPOINT_COLS, id, body);
      await bumpContentVersion(q, before.levelId);
      const after = await selectOne(q, CHECKPOINT_SELECT, 'c', id, 'Checkpoint');
      await auditUpdate(req, q, 'UPDATE_CHECKPOINT', 'level_checkpoint', id, before, after);
      return { checkpoint: after };
    });
  });

  app.delete('/api/admin/checkpoints/:id', manage, async (req, reply) => {
    const { id } = UuidParam.parse(req.params);
    await db.tx(async (q) => {
      const before = await selectOne<{ levelId: string }>(q, CHECKPOINT_SELECT, 'c', id, 'Checkpoint', true);
      const { rows } = await q.query('SELECT 1 FROM level_objectives WHERE checkpoint_id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
      if (rows[0]) throw conflict('An objective uses this checkpoint. Delete or change the objective first.', 'IN_USE');
      await q.query('UPDATE level_checkpoints SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      await bumpContentVersion(q, before.levelId);
      await audit(q, req, { action: 'DELETE_CHECKPOINT', entityType: 'level_checkpoint', entityId: id, oldData: before });
    });
    return reply.status(204).send();
  });

  // ── objectives ─────────────────────────────────────────────────────────
  app.post('/api/admin/levels/:id/objectives', manage, async (req, reply) => {
    const { id: levelId } = UuidParam.parse(req.params);
    const body = ObjectiveFields.partial({ description: true, checkpointId: true, config: true, sortOrder: true, required: true }).strict().parse(req.body);
    const objective = await db.tx(async (q) => {
      await assertLevel(q, levelId);
      await checkObjectiveCheckpoint(q, levelId, body.type, body.checkpointId ?? null);
      const sortOrder = body.sortOrder ?? (await nextSortOrder(q, 'level_objectives', levelId));
      const id = await insertRow(q, 'level_objectives', OBJECTIVE_COLS, { ...body, sortOrder }, { level_id: levelId });
      await bumpContentVersion(q, levelId);
      const row = await selectOne(q, OBJECTIVE_SELECT, 'o', id, 'Objective');
      await audit(q, req, { action: 'CREATE_OBJECTIVE', entityType: 'level_objective', entityId: id, newData: row });
      return row;
    });
    return reply.status(201).send({ objective });
  });

  app.patch('/api/admin/objectives/:id', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = ObjectiveFields.partial().strict().parse(req.body);
    return db.tx(async (q) => {
      const before = await selectOne<{ levelId: string; type: string; checkpointId: string | null }>(q, OBJECTIVE_SELECT, 'o', id, 'Objective', true);
      await checkObjectiveCheckpoint(q, before.levelId, body.type ?? before.type, body.checkpointId !== undefined ? body.checkpointId : before.checkpointId);
      await patchRow(q, 'level_objectives', OBJECTIVE_COLS, id, body);
      await bumpContentVersion(q, before.levelId);
      const after = await selectOne(q, OBJECTIVE_SELECT, 'o', id, 'Objective');
      await auditUpdate(req, q, 'UPDATE_OBJECTIVE', 'level_objective', id, before, after);
      return { objective: after };
    });
  });

  app.delete('/api/admin/objectives/:id', manage, async (req, reply) => {
    const { id } = UuidParam.parse(req.params);
    await db.tx(async (q) => {
      const before = await selectOne<{ levelId: string }>(q, OBJECTIVE_SELECT, 'o', id, 'Objective', true);
      await q.query('UPDATE level_objectives SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      const { rows } = await q.query<{ status: string }>('SELECT status FROM levels WHERE id = $1', [before.levelId]);
      if (rows[0]?.status === 'PUBLISHED') {
        const problems = await publishProblems(q, before.levelId);
        if (problems.length) throw unprocessable('LEVEL_NOT_READY', 'This change would break a published level.', problems);
      }
      await bumpContentVersion(q, before.levelId);
      await audit(q, req, { action: 'DELETE_OBJECTIVE', entityType: 'level_objective', entityId: id, oldData: before });
    });
    return reply.status(204).send();
  });

  // ── hints ──────────────────────────────────────────────────────────────
  app.post('/api/admin/levels/:id/hints', manage, async (req, reply) => {
    const { id: levelId } = UuidParam.parse(req.params);
    const body = HintFields.partial({ cost: true, sortOrder: true }).strict().parse(req.body);
    const hint = await db.tx(async (q) => {
      await assertLevel(q, levelId);
      const sortOrder = body.sortOrder ?? (await nextSortOrder(q, 'level_hints', levelId));
      const id = await insertRow(q, 'level_hints', HINT_COLS, { ...body, sortOrder }, { level_id: levelId });
      const row = await selectOne(q, HINT_SELECT, 'h', id, 'Hint');
      await audit(q, req, { action: 'CREATE_HINT', entityType: 'level_hint', entityId: id, newData: row });
      return row;
    });
    return reply.status(201).send({ hint });
  });

  app.patch('/api/admin/hints/:id', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = HintFields.partial().strict().parse(req.body);
    return db.tx(async (q) => {
      const before = await selectOne(q, HINT_SELECT, 'h', id, 'Hint', true);
      await patchRow(q, 'level_hints', HINT_COLS, id, body);
      const after = await selectOne(q, HINT_SELECT, 'h', id, 'Hint');
      await auditUpdate(req, q, 'UPDATE_HINT', 'level_hint', id, before, after);
      return { hint: after };
    });
  });

  app.delete('/api/admin/hints/:id', manage, async (req, reply) => {
    const { id } = UuidParam.parse(req.params);
    await db.tx(async (q) => {
      const before = await selectOne(q, HINT_SELECT, 'h', id, 'Hint', true);
      await q.query('UPDATE level_hints SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      await audit(q, req, { action: 'DELETE_HINT', entityType: 'level_hint', entityId: id, oldData: before });
    });
    return reply.status(204).send();
  });

  // ── prerequisites ──────────────────────────────────────────────────────
  app.get('/api/admin/levels/:id/prerequisites', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    await selectOne(db, LEVEL_SELECT, 'l', id, 'Level');
    return { groups: await readPrerequisites(db, id) };
  });

  /** Replaces all rule groups of a level. */
  app.put('/api/admin/levels/:id/prerequisites', manage, async (req) => {
    const { id } = UuidParam.parse(req.params);
    const body = PrerequisitesBody.parse(req.body);
    return db.tx(async (q) => {
      await assertLevel(q, id);
      const all = body.groups.flatMap((g) => g.requirements);
      if (all.some((r) => 'levelId' in r && r.levelId === id)) throw unprocessable('PREREQUISITE_CYCLE', 'A level cannot require itself.');
      if (await createsCycle(q, id, all)) throw unprocessable('PREREQUISITE_CYCLE', 'These prerequisites would create a loop between levels.');
      const before = await readPrerequisites(q, id);
      await q.query('DELETE FROM level_prerequisite_groups WHERE level_id = $1', [id]);
      for (const [i, g] of body.groups.entries()) {
        const { rows } = await q.query<{ id: string }>('INSERT INTO level_prerequisite_groups (level_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id', [id, g.name ?? null, i + 1]);
        for (const r of g.requirements) {
          await q.query(
            `INSERT INTO level_prerequisites (group_id, level_id, requirement_type, prerequisite_level_id, prerequisite_world_id, achievement_id, required_stars, required_xp)
             VALUES ($1, $2, $3::prerequisite_type, $4, $5, $6, $7, $8)`,
            [
              rows[0]!.id, id, r.type,
              r.type === 'LEVEL_COMPLETED' || r.type === 'LEVEL_STARS' ? r.levelId : null,
              r.type === 'WORLD_COMPLETED' ? r.worldId : null,
              r.type === 'ACHIEVEMENT' ? r.achievementId : null,
              r.type === 'LEVEL_STARS' || r.type === 'TOTAL_STARS' ? r.stars : null,
              r.type === 'TOTAL_XP' ? r.xp : null,
            ],
          );
        }
      }
      const after = await readPrerequisites(q, id);
      await audit(q, req, { action: 'SET_PREREQUISITES', entityType: 'level', entityId: id, oldData: before, newData: after });
      return { groups: after };
    });
  });
}
