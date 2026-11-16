import type { WorldTheme } from '../../content/worlds/types';

/*
 * World adventure maps (the map a student walks through inside one world).
 *
 *   curriculum (content/adventures/*.ts)  — what the stops are: missions,
 *                                           checkpoints, gates, challenges
 *   layout (layout.ts, pure)              — where they sit on the terrain
 *   state (adventure-state.ts, pure)      — what the student has done, from
 *                                           the level progress + real levels
 *
 * Playable missions are the real levels of the world (LevelRegistry, i.e. the
 * API catalog); they fill the mission stops in order. Stops without a level
 * are planned missions ("coming soon").
 */

export type StopKind = 'mission' | 'challenge' | 'checkpoint' | 'gate' | 'final';

/** One stop on the curriculum, in journey order. */
export interface AdventureStopDef {
  /** Stable within the world, e.g. "m09", "cp1", "m17a". */
  readonly id: string;
  readonly kind: StopKind;
  readonly title: string;
  readonly description: string;
  readonly skills: readonly string[];
  /** 1–5. */
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly reward: { readonly xp: number; readonly stars: number };
  /** Challenges only: the main mission the optional branch leaves from. */
  readonly branchOf?: string;
  /** Bind this stop to a specific level id (otherwise missions are filled in order). */
  readonly levelId?: string;
}

/** A named area of the map (label + landmark), covering the stops up to `untilStop`. */
export interface AdventureRegion {
  readonly name: string;
  /** Last stop id inside this region. */
  readonly untilStop: string;
}

export interface WorldAdventure {
  readonly worldId: string;
  /** Short "what you learn here" line for the sidebar. */
  readonly intro: string;
  readonly stops: readonly AdventureStopDef[];
  readonly regions: readonly AdventureRegion[];
  /** Seed for terrain decoration (different scatter per world). */
  readonly seed: number;
}

// ---------------------------------------------------------------- layout ---

/**
 * A point on the island ground plane. World units (≈ metres): `x` = world X,
 * `y` = world Z (towards the camera). Heights come from the terrain.
 */
export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** What a region looks like (terrain tint + props), from its name. */
export type RegionFlavor = 'base' | 'tech' | 'meadow' | 'forest' | 'river' | 'rocky' | 'arena';

export interface PlacedStop {
  readonly def: AdventureStopDef;
  readonly pos: Pt;
  /** Ground height at the stop. */
  readonly h: number;
  /** Main-path index (challenges share their branch's index). */
  readonly index: number;
  /** Arc position 0–1 along the main path. */
  readonly t: number;
}

export interface MapRegion {
  readonly name: string;
  readonly flavor: RegionFlavor;
}

/** Where the road crosses the world's river (gorge) — the bridge. */
export interface Crossing {
  /** River centre line. */
  readonly river: readonly Pt[];
  readonly bridge: Pt;
  /** Road direction at the bridge (radians, atan2(dz, dx)). */
  readonly angle: number;
}

/** Everything the 3D scene needs: pure, deterministic from the adventure. */
export interface AdventureLayout {
  readonly theme: WorldTheme;
  /** Island bounds (world units). */
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  readonly start: Pt;
  /** Main road through every non-challenge stop (dense polyline). */
  readonly route: readonly Pt[];
  /** Road height at each route point (terraces rise section by section). */
  readonly routeY: readonly number[];
  /** Region index of each route point (into `regions`). */
  readonly routeRegion: readonly number[];
  /** Index into `route` of each main stop (same order as `main`). */
  readonly routeIndex: readonly number[];
  readonly main: readonly PlacedStop[];
  readonly challenges: readonly PlacedStop[];
  readonly regions: readonly MapRegion[];
  readonly crossing: Crossing | null;
  readonly seed: number;
}

// ----------------------------------------------------------------- state ---

export type StopStatus = 'completed' | 'current' | 'available' | 'locked';

/** A stop with the student's state (what the map and panels render). */
export interface StopView {
  readonly id: string;
  readonly kind: StopKind;
  /** "01", "17-A", "CP 1", "GATE 2", "24". */
  readonly label: string;
  /** Mission number on the main path (missions + final), else null. */
  readonly number: number | null;
  readonly title: string;
  readonly description: string;
  readonly skills: readonly string[];
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly reward: { readonly xp: number; readonly stars: number };
  readonly status: StopStatus;
  /** Real level behind the stop (playable when not locked). */
  readonly levelId: string | null;
  /** No level exists for it yet. */
  readonly planned: boolean;
  readonly bestStars: number;
  /** Why it can't be opened (null when open). */
  readonly lockReason: string | null;
  readonly optional: boolean;
  readonly pos: Pt;
}

export type SegmentState = 'done' | 'open' | 'locked';

export interface AdventureView {
  readonly stops: readonly StopView[];
  /** Main path pieces: route[from..to] with the state of the stop it leads to. */
  readonly segments: readonly { readonly from: number; readonly to: number; readonly state: SegmentState }[];
  /** Challenge branches: from the branch stop to the challenge. */
  readonly branches: readonly { readonly from: Pt; readonly to: Pt; readonly state: SegmentState }[];
  /** Stop to continue with (null when nothing is open). */
  readonly current: StopView | null;
  /** Where the camera starts: current, else last completed, else the start. */
  readonly focus: Pt;
  readonly missionsCompleted: number;
  readonly missionsTotal: number;
  /** Missions that exist as real levels. */
  readonly playable: number;
}
