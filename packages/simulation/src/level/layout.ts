import type { Area2D, MapDefinition, MapEntity, Pose2D } from '@robolab/shared';

/**
 * One layout of a level (`LevelDefinition.variants`): entities added or left
 * out, start and goal moved, mission data overridden. Levels with several
 * layouts get a different one on load and on every Reset, so programs have to
 * sense the world instead of memorising it.
 */
export interface LevelLayout {
  readonly id: string;
  readonly add?: readonly MapEntity[];
  /** Ids of base map entities this layout leaves out. */
  readonly remove?: readonly string[];
  readonly start?: Pose2D;
  readonly finish?: Area2D;
  readonly data?: Readonly<Record<string, number>>;
}

/** What a layout changes: the map and the mission data. */
export interface LayoutSource {
  readonly map: MapDefinition;
  readonly data?: Readonly<Record<string, number>> | undefined;
  readonly variants?: readonly LevelLayout[] | undefined;
}

/** How many layouts a level has (1 without variants). */
export const layoutCount = (level: Pick<LayoutSource, 'variants'>): number => Math.max(1, level.variants?.length ?? 0);

/** Wraps any index (negative / out of range) onto the level's layouts. */
export const layoutIndex = (level: Pick<LayoutSource, 'variants'>, index: number): number => {
  const n = layoutCount(level);
  return ((Math.trunc(index) % n) + n) % n;
};

/**
 * The map and mission data as played with layout `index`. Pure; the map id
 * stays the same, so saved programs and progress don't depend on the layout.
 */
export function applyLayout(level: LayoutSource, index: number): { readonly map: MapDefinition; readonly data: Readonly<Record<string, number>> | undefined } {
  const v = level.variants?.[layoutIndex(level, index)];
  if (!v) return { map: level.map, data: level.data };
  const removed = new Set(v.remove ?? []);
  const map: MapDefinition = {
    ...level.map,
    ...(v.start && { start: v.start }),
    ...(v.finish && { finish: v.finish }),
    entities: [...level.map.entities.filter((e) => !removed.has(e.id)), ...(v.add ?? [])],
  };
  return { map, data: level.data || v.data ? { ...level.data, ...v.data } : undefined };
}
