import type { LevelScene } from '../../../../../content/levels/types';
import type { TerrainPalette } from '../../terrain/fields';
import type { RoadStyle } from '../../terrain/Road';

/*
 * Starter Island regions — pure data. Missions 4–24 are spread over the
 * island's regions (meadow, forest, river, facility, canyon pass, research
 * outpost, arena); each region is one reusable look (terrain palette, road,
 * scenery mix) and every mission adds its own landmark (`landmarks.ts`), so
 * no two missions are the same place.
 */

export type RegionId = 'meadow' | 'forest' | 'river' | 'facility' | 'canyon' | 'outpost' | 'city';

/** What fills the scenery around the course. */
export type SceneryKind = 'tree' | 'autumnTree' | 'pine' | 'bush' | 'tuft' | 'flowers' | 'rock' | 'reeds' | 'cactus' | 'crate' | 'barrel' | 'lamp' | 'container' | 'tank' | 'radar' | 'mast' | 'bench' | 'mushroom' | 'log' | 'tower' | 'car';

export interface RegionPreset {
  readonly id: RegionId;
  readonly palette: TerrainPalette;
  readonly road: RoadStyle;
  /** `landscape()` shaping: flat margin, hill height, horizon height. */
  readonly flat: number;
  readonly hills: number;
  readonly horizon: number;
  /** Near the course (inside the playable area): weighted scenery. */
  readonly near: readonly (readonly [SceneryKind, number])[];
  /** Beyond the course: weighted scenery (tall props allowed away from the camera). */
  readonly far: readonly (readonly [SceneryKind, number])[];
  /** Scenery counts at full density. */
  readonly nearCount: number;
  readonly farCount: number;
  /** Colour of the course edge rocks / stones. */
  readonly stone: string;
}

export const REGIONS: Readonly<Record<RegionId, RegionPreset>> = {
  meadow: {
    id: 'meadow',
    palette: { floor: '#8fd166', floor2: '#a3dc78', low: '#7d6a4f', mid: '#7cc95c', high: '#5fae4c', cliff: '#9c8f76', highAt: 2.2 },
    road: { surface: '#d9c08e', edge: '#a88a5c', roughness: 0.95 },
    flat: 1.0,
    hills: 1.4,
    horizon: 4.5,
    near: [['flowers', 4], ['tuft', 4], ['bush', 2], ['tree', 1]],
    far: [['tree', 6], ['bush', 2], ['flowers', 1]],
    nearCount: 70,
    farCount: 120,
    stone: '#b3b8c6',
  },
  forest: {
    id: 'forest',
    palette: { floor: '#6fae4f', floor2: '#5e9a44', low: '#5f4e3a', mid: '#5a9a45', high: '#3f7c37', cliff: '#7d735f', highAt: 2.4 },
    road: { surface: '#b08a5a', edge: '#7c5f3c', roughness: 0.98 },
    flat: 0.8,
    hills: 1.9,
    horizon: 6,
    near: [['tuft', 4], ['mushroom', 2], ['bush', 3], ['log', 1], ['rock', 1], ['pine', 1]],
    far: [['pine', 6], ['tree', 3], ['autumnTree', 1]],
    nearCount: 80,
    farCount: 150,
    stone: '#8d9488',
  },
  river: {
    id: 'river',
    palette: { floor: '#8ccf6a', floor2: '#9fd47f', low: '#6f7f5a', mid: '#79c35e', high: '#5ea84f', cliff: '#8f8a78', highAt: 2.0 },
    road: { surface: '#b89468', edge: '#8a6a45', roughness: 0.9 },
    flat: 1.0,
    hills: 1.3,
    horizon: 4.5,
    near: [['reeds', 4], ['tuft', 3], ['rock', 2], ['flowers', 1]],
    far: [['tree', 5], ['pine', 1], ['bush', 2]],
    nearCount: 70,
    farCount: 120,
    stone: '#a3a8b8',
  },
  facility: {
    id: 'facility',
    palette: { floor: '#94c46f', floor2: '#a3cb80', low: '#6b7280', mid: '#86bb62', high: '#6fa653', cliff: '#8b8f99', highAt: 2.0 },
    road: { surface: '#5b6475', edge: '#e5e7eb', roughness: 0.8 },
    flat: 1.3,
    hills: 1.2,
    horizon: 4,
    near: [['crate', 3], ['barrel', 3], ['lamp', 1]],
    far: [['container', 3], ['tank', 2], ['tree', 3], ['lamp', 1]],
    nearCount: 34,
    farCount: 70,
    stone: '#9aa0b5',
  },
  canyon: {
    id: 'canyon',
    palette: { floor: '#e2a86d', floor2: '#d89a5f', low: '#b0643a', mid: '#d0834b', high: '#c26a3d', cliff: '#a8552f', strata: '#e7b27a', highAt: 2.6 },
    road: { surface: '#c98f5a', edge: '#9a5f36', roughness: 0.98 },
    flat: 0.6,
    hills: 2.6,
    horizon: 7,
    near: [['rock', 4], ['cactus', 1], ['tuft', 2]],
    far: [['rock', 4], ['cactus', 3]],
    nearCount: 40,
    farCount: 75,
    stone: '#c26a3d',
  },
  outpost: {
    id: 'outpost',
    palette: { floor: '#9cc486', floor2: '#b1cf99', low: '#6d7a6a', mid: '#8fb57a', high: '#dfe7ee', cliff: '#8a93a3', peak: '#f4f7fb', peakAt: 2.6, highAt: 2.2 },
    road: { surface: '#8a8f99', edge: '#d7dbe2', roughness: 0.9 },
    flat: 1.0,
    hills: 2.0,
    horizon: 6.5,
    near: [['tuft', 3], ['rock', 2], ['crate', 1], ['barrel', 1]],
    far: [['pine', 6], ['rock', 2], ['radar', 1], ['mast', 1]],
    nearCount: 50,
    farCount: 120,
    stone: '#9aa3b2',
  },
  /** Rescue City (mission 24): pavement ground, asphalt streets, a skyline of towers beyond the district. */
  city: {
    id: 'city',
    palette: { floor: '#b7bcc4', floor2: '#aab0b9', low: '#5d6778', mid: '#8fae6a', high: '#6f9450', cliff: '#7f8797', highAt: 2.0 },
    road: { surface: '#3a4150', edge: '#d9dde3', roughness: 0.85 },
    flat: 2.0,
    hills: 1.0,
    horizon: 3.5,
    near: [['lamp', 2], ['tree', 2], ['bench', 1], ['car', 2]],
    far: [['tower', 6], ['tree', 2]],
    nearCount: 10,
    farCount: 90,
    stone: '#9aa0b5',
  },
};

/** Pick from a weighted list with a 0..1 roll. */
export function pickWeighted<T>(list: readonly (readonly [T, number])[], roll: number): T {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = roll * total;
  for (const [v, w] of list) {
    if ((r -= w) < 0) return v;
  }
  return list[list.length - 1]![0];
}

/** Direction (unit) of the last road segment — landmarks face the arriving robot. */
export function arrivalDirection(scene: LevelScene): { x: number; z: number } {
  const p = scene.path;
  const a = p[p.length - 2];
  const b = p[p.length - 1];
  if (!a || !b) return { x: 1, z: 0 };
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
}
