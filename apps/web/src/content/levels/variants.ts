import type { LevelDefinition } from './types';

/** How many layouts a level has (1 without variants). */
export const variantCount = (level: LevelDefinition): number => Math.max(1, level.variants?.length ?? 0);

/**
 * The level as played with layout `index`: the variant's entities added /
 * removed, start and goal moved, mission data merged. Without variants (or
 * for an out-of-range index on a level without them) the level itself.
 * Pure: the map id stays the same, so saved programs and progress don't care
 * which layout was played.
 */
export function applyVariant(level: LevelDefinition, index: number): LevelDefinition {
  const v = level.variants?.[((index % variantCount(level)) + variantCount(level)) % variantCount(level)];
  if (!v) return level;
  const removed = new Set(v.remove ?? []);
  const map = {
    ...level.map,
    ...(v.start && { start: v.start }),
    ...(v.finish && { finish: v.finish }),
    entities: [...level.map.entities.filter((e) => !removed.has(e.id)), ...(v.add ?? [])],
  };
  return { ...level, map, ...((level.data || v.data) && { data: { ...level.data, ...v.data } }) };
}

/** Every mission value name the level (or any of its layouts) provides, sorted. */
export function missionDataKeys(level: LevelDefinition): string[] {
  const keys = new Set(Object.keys(level.data ?? {}));
  for (const v of level.variants ?? []) for (const k of Object.keys(v.data ?? {})) keys.add(k);
  return [...keys].sort();
}
