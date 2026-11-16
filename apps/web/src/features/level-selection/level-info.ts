import { createMapEngine } from '@robolab/map-engine';
import type { MapQuery } from '@robolab/shared';
import type { LevelDefinition } from '../../content/levels/types';
import { buildMissionView } from '../../data/mission';
import { CATEGORIES, categoryOf, type CategoryDef } from '../programming/blocks/block-registry';

/*
 * Read-only views of level data for the mission cards / detail panel.
 * Everything comes from the level definition — nothing is authored twice.
 */

/** Objective labels, exactly as the in-simulator mission card words them. */
export const levelObjectives = (level: LevelDefinition): string[] => buildMissionView(level.mission, level.map, null).objectives.map((o) => o.label);

/** Block categories the student can use in this level ("Available tools"), minus Events (always there). */
export function levelTools(level: LevelDefinition): CategoryDef[] {
  if (level.allowedBlocks === 'all') return CATEGORIES.filter((c) => c.id !== 'events');
  const ids = new Set(level.allowedBlocks.map((t) => categoryOf(t).id));
  return CATEGORIES.filter((c) => c.id !== 'events' && ids.has(c.id));
}

/** Star criteria in words (same rules as `stars.ts`). */
export function starGoals(level: LevelDefinition): string[] {
  const goals = ['Complete the mission'];
  if (level.stars.parBlocks !== undefined) goals.push(`Use ${level.stars.parBlocks} blocks or fewer`);
  if (level.stars.parSeconds !== undefined) goals.push(`Finish within ${level.stars.parSeconds} s`);
  return goals;
}

const engine = createMapEngine();
const queries = new Map<string, MapQuery>();
/** Cached map query for previews (maps are static data). */
export function levelMapQuery(level: LevelDefinition): MapQuery {
  let q = queries.get(level.map.id);
  if (!q) queries.set(level.map.id, (q = engine.load(level.map)));
  return q;
}
