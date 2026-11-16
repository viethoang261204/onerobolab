import { z } from 'zod';
import type { Queryable } from '../db/db.ts';

/** A map point `{x, z, …}` in metres. */
export const Point = z.object({ x: z.number().finite().min(-1000).max(1000), z: z.number().finite().min(-1000).max(1000) }).catchall(z.unknown());

/**
 * Why a level can't be published yet (empty = ready): students must be able
 * to play it and the server must be able to score it.
 */
export async function publishProblems(q: Queryable, levelId: string): Promise<string[]> {
  const { rows } = await q.query<{ map_definition: Record<string, unknown>; objectives: number; goals: number; env_ok: boolean }>(
    `SELECT l.map_definition,
            (SELECT count(*) FROM level_objectives o WHERE o.level_id = l.id AND o.deleted_at IS NULL)::int AS objectives,
            (SELECT count(*) FROM level_objectives o WHERE o.level_id = l.id AND o.deleted_at IS NULL AND o.objective_type = 'REACH_GOAL')::int AS goals,
            EXISTS (SELECT 1 FROM environments e WHERE e.id = l.environment_id AND e.deleted_at IS NULL) AS env_ok
       FROM levels l WHERE l.id = $1`,
    [levelId],
  );
  const l = rows[0];
  if (!l) return ['The level does not exist.'];
  const problems: string[] = [];
  if (!Point.safeParse(l.map_definition.start).success) problems.push('The map has no start position.');
  if (!Point.safeParse((l.map_definition.finish as { center?: unknown } | undefined)?.center).success) problems.push('The map has no finish zone.');
  if (l.objectives === 0) problems.push('The level has no objectives.');
  if (l.goals === 0) problems.push('The level needs a REACH_GOAL objective.');
  if (!l.env_ok) problems.push('The environment does not exist.');
  return problems;
}

/**
 * Prerequisite groups of levels as JSON (`$1` = level id array), with the
 * names an admin needs to read them. Groups are OR-ed, requirements AND-ed.
 */
export const PREREQUISITES_SQL = `
  SELECT g.level_id AS "levelId", g.id AS "groupId", g.name, g.sort_order AS "sortOrder",
         COALESCE(json_agg(json_strip_nulls(json_build_object(
           'type', p.requirement_type,
           'levelId', p.prerequisite_level_id, 'levelSlug', pl.slug, 'levelTitle', pl.title,
           'worldId', p.prerequisite_world_id, 'worldName', pw.name,
           'achievementId', p.achievement_id, 'achievementName', pa.name,
           'stars', p.required_stars, 'xp', p.required_xp)) ORDER BY p.created_at)
           FILTER (WHERE p.id IS NOT NULL), '[]') AS requirements
    FROM level_prerequisite_groups g
    LEFT JOIN level_prerequisites p ON p.group_id = g.id
    LEFT JOIN levels pl ON pl.id = p.prerequisite_level_id
    LEFT JOIN worlds pw ON pw.id = p.prerequisite_world_id
    LEFT JOIN achievements pa ON pa.id = p.achievement_id
   WHERE g.level_id = ANY($1::uuid[])
   GROUP BY g.id ORDER BY g.level_id, g.sort_order`;

export interface PrerequisiteGroup {
  levelId: string;
  groupId: string;
  name: string | null;
  sortOrder: number;
  requirements: Record<string, unknown>[];
}

/** Prerequisite groups for many levels at once, keyed by level id. */
export async function prerequisitesFor(q: Queryable, levelIds: readonly string[]): Promise<Map<string, Omit<PrerequisiteGroup, 'levelId'>[]>> {
  const out = new Map<string, Omit<PrerequisiteGroup, 'levelId'>[]>();
  if (!levelIds.length) return out;
  const { rows } = await q.query<PrerequisiteGroup>(PREREQUISITES_SQL, [levelIds]);
  for (const { levelId, ...group } of rows) out.set(levelId, [...(out.get(levelId) ?? []), group]);
  return out;
}
