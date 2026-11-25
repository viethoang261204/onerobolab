import { applyLayout, layoutCount } from '@robolab/simulation';
import type { LevelDefinition } from './types';

/** How many layouts a level has (1 without variants). */
export const variantCount = (level: LevelDefinition): number => layoutCount(level);

/**
 * The level as played with layout `index` (`@robolab/simulation` `applyLayout`:
 * the same function the API judge plays). Pure: the map id stays the same, so
 * saved programs and progress don't care which layout was played.
 */
export function applyVariant(level: LevelDefinition, index: number): LevelDefinition {
  if (!level.variants?.length) return level;
  const { map, data } = applyLayout(level, index);
  return { ...level, map, ...(data && { data }) };
}

/** Every mission value name the level (or any of its layouts) provides, sorted. */
export function missionDataKeys(level: LevelDefinition): string[] {
  const keys = new Set(Object.keys(level.data ?? {}));
  for (const v of level.variants ?? []) for (const k of Object.keys(v.data ?? {})) keys.add(k);
  return [...keys].sort();
}
