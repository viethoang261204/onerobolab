import type { Placement } from './scene/journey-layout';
import type { WorldSummary } from './world-progress';

/** What the 3D map needs per world (derived; see `world-progress.ts`). */
export interface IslandView {
  readonly summary: WorldSummary;
  readonly selected: boolean;
  readonly hovered: boolean;
  /** The student's current world (robot parks here). */
  readonly current: boolean;
  /** Where it sits on the Explore journey. */
  readonly placement: Placement;
}

/** Pixel space covered by HTML panels over the canvas. */
export interface MapInsets {
  readonly left: number;
  readonly right: number;
}
