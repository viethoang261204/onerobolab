import type { Queryable } from '../db/db.ts';
import { forbidden, notFound } from '../http/errors.ts';
import { DEFAULT_POINTS, type LevelRules, type ObjectiveRule, type PointRules } from './scoring.ts';

export type LevelState = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'DISABLED';

export interface LevelAccess {
  readonly levelId: string;
  readonly state: LevelState;
  readonly reason: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

/** Resolve a level by UUID or slug (non-deleted). */
export async function findLevelId(q: Queryable, idOrSlug: string): Promise<string | null> {
  const { rows } = await q.query<{ id: string }>(
    `SELECT id FROM levels WHERE deleted_at IS NULL AND ${isUuid(idOrSlug) ? 'id = $1::uuid' : 'slug = $1'}`,
    [idOrSlug],
  );
  return rows[0]?.id ?? null;
}

/** Effective state of every visible level for a student (database function). */
export async function levelStates(q: Queryable, studentId: string): Promise<Map<string, LevelAccess>> {
  const { rows } = await q.query<{ level_id: string; state: LevelState; reason: string }>('SELECT level_id, state, reason FROM get_student_level_states($1)', [studentId]);
  return new Map(rows.map((r) => [r.level_id, { levelId: r.level_id, state: r.state, reason: r.reason }]));
}

/**
 * The student's access to one level — decided by the server from
 * publication, visibility, overrides, prerequisites and progress. Hidden or
 * unpublished levels are 404 (their existence isn't revealed).
 */
export async function levelAccess(q: Queryable, studentId: string, idOrSlug: string): Promise<LevelAccess> {
  const levelId = await findLevelId(q, idOrSlug);
  if (!levelId) throw notFound('Level');
  const { rows } = await q.query<{ state: LevelState; reason: string }>('SELECT state, reason FROM get_student_level_states($1) WHERE level_id = $2', [studentId, levelId]);
  if (!rows[0]) throw notFound('Level');
  return { levelId, state: rows[0].state, reason: rows[0].reason };
}

const LOCK_MESSAGES: Record<string, string> = {
  PREREQUISITES_NOT_MET: 'Finish the earlier missions to unlock this one.',
  LOCKED_BY_ADMIN: 'This mission is locked for now.',
  ADMIN_OVERRIDE: 'Your teacher has locked this mission for you.',
};

/** Throws 403 LEVEL_LOCKED unless the student may play the level. */
export function assertPlayable(access: LevelAccess): void {
  if (access.state === 'LOCKED' || access.state === 'DISABLED') {
    const err = forbidden(LOCK_MESSAGES[access.reason] ?? 'This mission is locked.', 'LEVEL_LOCKED');
    Object.assign(err, { details: { state: access.state, reason: access.reason } });
    throw err;
  }
}

interface LevelRow {
  par_blocks: number | null;
  par_seconds: number | string | null;
  max_stars: number;
  xp_reward: number;
  allowed_blocks: string[] | null;
  map_definition: { start?: { x: number; z: number }; finish?: { center?: { x: number; z: number } } };
  mission_settings: { failOnCollision?: boolean; timeLimit?: number | null; scoring?: unknown };
}

/** Rules the server scores against, loaded from the level's rows. */
export async function loadLevelRules(q: Queryable, levelId: string): Promise<LevelRules & { xpReward: number; allowedBlocks: string[] | null }> {
  const { rows } = await q.query<LevelRow>(
    'SELECT par_blocks, par_seconds, max_stars, xp_reward, allowed_blocks, map_definition, mission_settings FROM levels WHERE id = $1',
    [levelId],
  );
  const l = rows[0];
  if (!l) throw notFound('Level');
  const { rows: objectives } = await q.query<{ code: string; objective_type: string; required: boolean; config: Record<string, unknown>; position: { x: number; z: number } | null }>(
    `SELECT o.code, o.objective_type, o.required, o.config, c.position
       FROM level_objectives o LEFT JOIN level_checkpoints c ON c.id = o.checkpoint_id
      WHERE o.level_id = $1 AND o.deleted_at IS NULL ORDER BY o.sort_order`,
    [levelId],
  );
  const start = l.map_definition.start;
  const finish = l.map_definition.finish?.center;
  return {
    parBlocks: l.par_blocks,
    parSeconds: l.par_seconds === null ? null : Number(l.par_seconds),
    maxStars: l.max_stars,
    xpReward: l.xp_reward,
    allowedBlocks: l.allowed_blocks,
    failOnCollision: l.mission_settings.failOnCollision ?? true,
    timeLimit: l.mission_settings.timeLimit ?? null,
    points: pointRulesFrom(l.mission_settings.scoring),
    start: start ? { x: start.x, z: start.z } : null,
    finish: finish ? { x: finish.x, z: finish.z } : null,
    objectives: objectives.map(
      (o): ObjectiveRule => ({ code: o.code, type: o.objective_type, required: o.required, config: o.config, position: o.position ? { x: Number(o.position.x), z: Number(o.position.z) } : null }),
    ),
  };
}

/** Point rules from `mission_settings.scoring` (defaults when absent or malformed). */
export function pointRulesFrom(raw: unknown): PointRules {
  const o = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!o(raw) || !n(raw.completionPoints) || !n(raw.checkpointPoints) || !n(raw.collisionPenalty)) return DEFAULT_POINTS;
  const t = raw.timeBonus;
  const e = raw.efficiencyBonus;
  return {
    completionPoints: raw.completionPoints,
    checkpointPoints: raw.checkpointPoints,
    collisionPenalty: raw.collisionPenalty,
    timeBonus: o(t) && n(t.parSeconds) && n(t.maxPoints) ? { parSeconds: t.parSeconds, maxPoints: t.maxPoints } : null,
    efficiencyBonus: o(e) && n(e.parBlocks) && n(e.maxPoints) ? { parBlocks: e.parBlocks, maxPoints: e.maxPoints } : null,
    ...(n(raw.bonusPoints) && { bonusPoints: raw.bonusPoints }),
  };
}
