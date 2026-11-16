/** Visual identity of a world on the map and in world cards. */
export type WorldTheme = 'starter' | 'canyon' | 'frost' | 'jungle' | 'skylab' | 'lava';

/**
 * A world: one chapter of the learning journey. Pure data — its missions are
 * the levels whose `world` field points here (`LevelRegistry.byWorld`), and
 * its progress / lock state is derived from the level progress store.
 */
export interface WorldDefinition {
  /** Stable id used in URLs (`/world/:worldId`). */
  readonly id: string;
  /** 1-based position on the journey. */
  readonly order: number;
  readonly name: string;
  /** One line for cards. */
  readonly tagline: string;
  /** Two sentences for the detail panel. */
  readonly description: string;
  readonly theme: WorldTheme;
  /** CSS accent colour. */
  readonly color: string;
  /** What students practise here (shown as chips). */
  readonly skills: readonly string[];
  /** 1–5, shown as stars. */
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  /** Island centre on the world map (scene units, Y up). */
  readonly mapPosition: { readonly x: number; readonly y: number; readonly z: number };
}
