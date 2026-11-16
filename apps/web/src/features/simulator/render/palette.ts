import type { SensorColor } from '@robolab/shared';

/**
 * Render colours for world objects. Sensor colours are *semantic* (what the
 * color sensor reports); these hex values are only how we draw them.
 */
export const SENSOR_COLOR_HEX: Record<Exclude<SensorColor, 'none'>, string> = {
  black: '#1b2233',
  white: '#e6ebf5',
  red: '#ef4444',
  green: '#22c55e',
  blue: '#2f7cf6',
  yellow: '#facc15',
};

/** Stylised daytime palette (placeholder world until the Phase 2 environment). */
export const WORLD = {
  skyTop: '#4f7fe6',
  skyMid: '#8fb0f2',
  skyHorizon: '#d9d2f7',
  fog: '#b9c3f2',
  floor: '#e3e8f2',
  gridCell: '#c9d1e3',
  gridSection: '#aeb9d4',
  platformSide: '#8791b0',
  wall: '#a5b0cb',
  boxStatic: '#7c8bb1',
  boxDynamic: '#f5a524',
  obstacle: '#ec4899',
  line: '#1b2233',
  checkpoint: '#22d3ee',
  finish: '#22c55e',
  start: '#8b5cf6',
  grass: '#6cc56a',
  rock: '#7d86a6',
  robotBody: '#f5f7fb',
  robotAccent: '#22d3ee',
  robotDark: '#1e2640',
  wheel: '#2a3148',
} as const;

/** Small vertical offsets that keep floor decals from z-fighting. */
export const FLOOR_LAYER = {
  zone: 0.001,
  line: 0.002,
  marker: 0.003,
} as const;
