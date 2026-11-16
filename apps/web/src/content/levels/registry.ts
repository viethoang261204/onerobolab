import { WorldRegistry } from '../worlds/registry';
import { CANYON_01 } from './canyon-circuit/canyon-01';
import { CANYON_02 } from './canyon-circuit/canyon-02';
import { CANYON_03 } from './canyon-circuit/canyon-03';
import { FROST_01 } from './frost-valley/frost-01';
import { JUNGLE_01 } from './jungle-ruins/jungle-01';
import { STARTER_01 } from './starter-island/starter-01';
import { STARTER_02 } from './starter-island/starter-02';
import { STARTER_03 } from './starter-island/starter-03';
import { STARTER_04 } from './starter-island/starter-04';
import { STARTER_05 } from './starter-island/starter-05';
import { STARTER_06 } from './starter-island/starter-06';
import { STARTER_07 } from './starter-island/starter-07';
import { STARTER_08 } from './starter-island/starter-08';
import { STARTER_09 } from './starter-island/starter-09';
import { STARTER_10 } from './starter-island/starter-10';
import { STARTER_11 } from './starter-island/starter-11';
import { STARTER_12 } from './starter-island/starter-12';
import { STARTER_13 } from './starter-island/starter-13';
import { STARTER_14 } from './starter-island/starter-14';
import { STARTER_15 } from './starter-island/starter-15';
import { STARTER_16 } from './starter-island/starter-16';
import { STARTER_17 } from './starter-island/starter-17';
import { STARTER_18 } from './starter-island/starter-18';
import { STARTER_19 } from './starter-island/starter-19';
import { STARTER_20 } from './starter-island/starter-20';
import { STARTER_21 } from './starter-island/starter-21';
import { STARTER_22 } from './starter-island/starter-22';
import { STARTER_23 } from './starter-island/starter-23';
import { STARTER_24 } from './starter-island/starter-24';
import type { LevelDefinition } from './types';

/**
 * The levels bundled with the app, in play order. They are the content the
 * database was seeded from, the offline/local fallback, and what the tests
 * prove solvable. Adding a level = add a content file + list it here; its
 * `world` must exist in `WorldRegistry`.
 */
export const LEVELS: readonly LevelDefinition[] = [
  STARTER_01,
  STARTER_02,
  STARTER_03,
  STARTER_04,
  STARTER_05,
  STARTER_06,
  STARTER_07,
  STARTER_08,
  STARTER_09,
  STARTER_10,
  STARTER_11,
  STARTER_12,
  STARTER_13,
  STARTER_14,
  STARTER_15,
  STARTER_16,
  STARTER_17,
  STARTER_18,
  STARTER_19,
  STARTER_20,
  STARTER_21,
  STARTER_22,
  STARTER_23,
  STARTER_24,
  CANYON_01, CANYON_02, CANYON_03, FROST_01, JUNGLE_01];

/** Levels in play: the bundled ones until a signed-in student's catalog replaces them (`setLevelCatalog`). */
let active: readonly LevelDefinition[] = LEVELS;

/** Use these levels everywhere (the API catalog after sign-in; `LEVELS` again after sign-out). */
export function setLevelCatalog(levels: readonly LevelDefinition[]): void {
  active = levels.length ? levels : LEVELS;
}

/**
 * Level ids from before worlds existed (UI 6). Saved progress and programs
 * are migrated on load so students keep their work.
 */
export const LEGACY_LEVEL_IDS: Readonly<Record<string, string>> = {
  'cs1-01': 'starter-01',
  'cs1-02': 'starter-02',
  'cs1-03': 'starter-03',
  'gd1-01': 'canyon-01',
  'gd1-02': 'canyon-02',
  'gd2-01': 'frost-01',
};

/** Current id for a possibly legacy level id. */
export const migrateLevelId = (id: string): string => LEGACY_LEVEL_IDS[id] ?? id;

export const LevelRegistry = {
  get all(): readonly LevelDefinition[] {
    return active;
  },
  get(id: string): LevelDefinition | undefined {
    return active.find((l) => l.id === id);
  },
  first(): LevelDefinition {
    return active[0] as LevelDefinition;
  },
  indexOf(id: string): number {
    return active.findIndex((l) => l.id === id);
  },
  next(id: string): LevelDefinition | null {
    const i = LevelRegistry.indexOf(id);
    return i >= 0 ? (active[i + 1] ?? null) : null;
  },
  byWorld(worldId: string): LevelDefinition[] {
    return active.filter((l) => l.world === worldId);
  },
  byMap(mapId: string): LevelDefinition | undefined {
    return active.find((l) => l.map.id === mapId);
  },
  /** Swap one level (e.g. after revealing a paid hint). */
  replace(level: LevelDefinition): void {
    active = active.map((l) => (l.id === level.id ? level : l));
  },
  /** Display code "world-mission", e.g. "1-3" = third mission of the first world. */
  code(level: LevelDefinition): string {
    return `${WorldRegistry.get(level.world)?.order ?? 0}-${level.number}`;
  },
};
