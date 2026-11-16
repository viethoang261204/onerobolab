import type { WorldTheme } from '../../../content/worlds/types';
import type { RegionFlavor } from '../adventure.types';

/**
 * Look of a world's adventure island (no three.js import): ground colours
 * per region flavour, cliffs, beach, sea, sky and which props grow there.
 * Vibrant but controlled — the navy/cyan HUD sits on top of it.
 */
export interface IslandTheme {
  readonly ground: Readonly<Record<RegionFlavor, string>>;
  /** Second ground tone for patchy variation. */
  readonly ground2: string;
  readonly cliff: string;
  readonly strata: string;
  readonly sand: string;
  readonly seabed: string;
  /** Snow / light caps on high peaks (optional). */
  readonly peak?: string;
  readonly road: string;
  readonly roadEdge: string;
  readonly sea: { readonly deep: string; readonly shallow: string; readonly foam: string };
  readonly sky: { readonly top: string; readonly horizon: string; readonly fog: string };
  readonly cloud: string;
  /** Tree kind for forests / meadows. */
  readonly tree: 'round' | 'pine' | 'snowPine' | 'jungle' | 'cactus' | 'crystal';
  readonly leaves: readonly string[];
  readonly rock: string;
  /** Bridge deck look. */
  readonly bridge: 'wood' | 'steel' | 'energy';
}

export const ISLAND_THEMES: Readonly<Record<WorldTheme, IslandTheme>> = {
  starter: {
    ground: { base: '#8fcf63', tech: '#7cc25a', meadow: '#8ed15a', forest: '#4f9f45', river: '#6fbf57', rocky: '#a3a784', arena: '#e8f1fb' },
    ground2: '#a6dc6c',
    cliff: '#8a7a6a',
    strata: '#6f6356',
    sand: '#ecd9a0',
    seabed: '#2f7fa8',
    peak: '#f4f8ff',
    road: '#d9c08f',
    roadEdge: '#a88a5c',
    sea: { deep: '#0b4f9c', shallow: '#2fb3e8', foam: '#ffffff' },
    sky: { top: '#1d4f9a', horizon: '#7cc2f0', fog: '#3d86c9' },
    cloud: '#ffffff',
    tree: 'round',
    leaves: ['#4cb35a', '#5cc466', '#3fa14e', '#6fcf6a', '#2f8f4e'],
    rock: '#9aa0b5',
    bridge: 'wood',
  },
  canyon: {
    ground: { base: '#e7b377', tech: '#e2a868', meadow: '#dca25e', forest: '#b99a52', river: '#cf9a5a', rocky: '#c8723f', arena: '#f1c98f' },
    ground2: '#efc28a',
    cliff: '#b5552f',
    strata: '#d9824a',
    sand: '#f3d3a0',
    seabed: '#2a6f9c',
    road: '#f3d7a8',
    roadEdge: '#b07a45',
    sea: { deep: '#0f5a8f', shallow: '#3cb4d8', foam: '#fff4e0' },
    sky: { top: '#2a4f8f', horizon: '#f2b47a', fog: '#7a6f99' },
    cloud: '#fff1e0',
    tree: 'cactus',
    leaves: ['#6b9a4a', '#7fae52', '#5b8a3f'],
    rock: '#a4553a',
    bridge: 'wood',
  },
  frost: {
    ground: { base: '#e6f0fb', tech: '#dde9f7', meadow: '#eef5fd', forest: '#d3e3f3', river: '#e3eef9', rocky: '#b9cbe0', arena: '#f7fbff' },
    ground2: '#ffffff',
    cliff: '#7f97b8',
    strata: '#9fb6d3',
    sand: '#cfe2f3',
    seabed: '#2b5f8f',
    peak: '#ffffff',
    road: '#9fb4cf',
    roadEdge: '#6d85a6',
    sea: { deep: '#0e3f78', shallow: '#6cc9ef', foam: '#ffffff' },
    sky: { top: '#1e3f7a', horizon: '#bfe3ff', fog: '#6f9fd0' },
    cloud: '#ffffff',
    tree: 'snowPine',
    leaves: ['#2f6f5a', '#2b6650'],
    rock: '#9fb4cf',
    bridge: 'steel',
  },
  jungle: {
    ground: { base: '#5fb35a', tech: '#56a950', meadow: '#6cc15a', forest: '#2f8a45', river: '#4aa257', rocky: '#7f8f72', arena: '#c9c19a' },
    ground2: '#78c85f',
    cliff: '#6b6155',
    strata: '#57503f',
    sand: '#e2d29b',
    seabed: '#1f7f86',
    road: '#c9a877',
    roadEdge: '#8a6a44',
    sea: { deep: '#0c5f78', shallow: '#2fd0c4', foam: '#e8fff8' },
    sky: { top: '#1b5a7a', horizon: '#9fe0d0', fog: '#3f8f95' },
    cloud: '#f2fff8',
    tree: 'jungle',
    leaves: ['#2e8b47', '#237a3c', '#3a9d52', '#1f6b34'],
    rock: '#7c8a7a',
    bridge: 'wood',
  },
  skylab: {
    ground: { base: '#d7deea', tech: '#cfd8e8', meadow: '#8fdcb0', forest: '#6cc995', river: '#a8e0c4', rocky: '#aab4cc', arena: '#eef2ff' },
    ground2: '#e6ebf5',
    cliff: '#5b6590',
    strata: '#7a84b0',
    sand: '#dfe7f7',
    seabed: '#c9d6f2',
    road: '#8f9cc4',
    roadEdge: '#5a6694',
    sea: { deep: '#9fb7ea', shallow: '#e7efff', foam: '#ffffff' },
    sky: { top: '#2a2f7a', horizon: '#b9c7ff', fog: '#8a9ee0' },
    cloud: '#ffffff',
    tree: 'crystal',
    leaves: ['#5ec8a0', '#7cd6b0'],
    rock: '#6d78a0',
    bridge: 'energy',
  },
  lava: {
    ground: { base: '#5a4f5f', tech: '#524858', meadow: '#4a4150', forest: '#3f3845', river: '#4f4555', rocky: '#3a3040', arena: '#6b5d70' },
    ground2: '#655a6a',
    cliff: '#2a2230',
    strata: '#ff6a1a',
    sand: '#3a2f38',
    seabed: '#ff5a1a',
    road: '#8d7f94',
    roadEdge: '#5a4e60',
    sea: { deep: '#ff4a10', shallow: '#ffc04a', foam: '#fff2b0' },
    sky: { top: '#1a0f1f', horizon: '#8a3a2a', fog: '#3a1a1f' },
    cloud: '#6b6170',
    tree: 'crystal',
    leaves: ['#ff6a1a', '#ffb347'],
    rock: '#3a3040',
    bridge: 'steel',
  },
};
