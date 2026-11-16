import type { Vec2 } from '@robolab/shared';
import type { WorldTheme } from '../../../content/worlds/types';
import { distToPolyline, fbm, hex, layeredColor, mixRgb, smoothstep, type ColorFn, type HeightFn } from '../../simulator/environments/terrain/fields';
import { ISLAND_RADIUS } from './island-decor';

/*
 * Island dioramas: every world gets its own landform (not one shape
 * recoloured). Pure height + colour fields in island-local metres (radius 2),
 * sampled by `WorldIsland` into a vertex-coloured mesh and by the decor to
 * seat props on the ground.
 */

const R = ISLAND_RADIUS;
const gauss = (x: number, z: number, cx: number, cz: number, s: number) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (s * s));

/** Canyon groove / jungle river / lava river centre lines. */
export const ISLAND_CHANNELS: Readonly<Partial<Record<WorldTheme, readonly Vec2[]>>> = {
  canyon: [
    { x: -2.2, z: -0.9 },
    { x: -0.9, z: -0.55 },
    { x: 0.2, z: -1.05 },
    { x: 1.2, z: -0.6 },
    { x: 2.2, z: -0.95 },
  ],
  jungle: [
    { x: 0.1, z: -1.2 },
    { x: 0.7, z: -0.5 },
    { x: 1.3, z: -0.1 },
    { x: 2.3, z: 0.25 },
  ],
  lava: [
    { x: -0.15, z: -0.75 },
    { x: -0.8, z: -0.25 },
    { x: -1.5, z: 0.25 },
    { x: -2.3, z: 0.5 },
  ],
};

export function islandHeight(theme: WorldTheme, seed: number): HeightFn {
  switch (theme) {
    case 'starter':
      return (x, z) => {
        const r = Math.hypot(x, z);
        const hills = smoothstep(0.9, 1.7, r) * 0.32 * (0.55 + 0.45 * fbm(x * 0.9, z * 0.9, seed));
        const pond = gauss(x, z, -1.0, -0.75, 0.38) * 0.12;
        return Math.max(0, hills - pond);
      };
    case 'canyon':
      return (x, z) => {
        const r = Math.hypot(x, z);
        const groove = distToPolyline({ x, z }, ISLAND_CHANNELS.canyon!);
        let h = 0.5 * smoothstep(0.25, 0.42, groove) * smoothstep(0.55, 0.9, r);
        h += 0.22 * gauss(x, z, -1.1, 0.9, 0.45) + 0.28 * gauss(x, z, 1.2, 0.7, 0.4);
        return Math.floor(h / 0.16) * 0.16 + smoothstep(0.7, 1, (h / 0.16) % 1) * 0.16;
      };
    case 'frost':
      return (x, z) => {
        const peaks = 1.25 * gauss(x, z, -0.55, -1.05, 0.55) + 0.95 * gauss(x, z, 0.75, -1.2, 0.5) + 0.5 * gauss(x, z, 1.4, -0.3, 0.4);
        const bumps = 0.05 * fbm(x * 2, z * 2, seed);
        return Math.max(0, (peaks + bumps) * smoothstep(0.5, 0.9, Math.hypot(x, z)));
      };
    case 'jungle':
      return (x, z) => {
        const terrace = Math.floor(Math.max(0, -z + 0.25) / 0.55) * 0.22;
        const mounds = 0.14 * Math.max(0, fbm(x * 1.4, z * 1.4, seed));
        const river = distToPolyline({ x, z }, ISLAND_CHANNELS.jungle!);
        const h = (terrace + mounds) * smoothstep(0.55, 0.9, Math.hypot(x, z));
        return Math.max(0, h - smoothstep(0.26, 0.1, river) * (h + 0.06));
      };
    case 'skylab':
      return (x, z) => {
        const deck = Math.hypot(x, z) > 1.45 ? 0.06 : 0;
        const upper = Math.hypot(x + 0.75, z + 0.55) < 0.62 ? 0.18 : 0;
        return deck + upper;
      };
    case 'lava':
      return (x, z) => {
        const d = Math.hypot(x + 0.15, z + 0.95);
        const cone = 1.15 * smoothstep(1.25, 0.15, d);
        const crater = smoothstep(0.34, 0.14, d) * 0.45;
        const river = distToPolyline({ x, z }, ISLAND_CHANNELS.lava!);
        const h = (cone - crater + 0.06 * fbm(x * 2.2, z * 2.2, seed)) * smoothstep(0.5, 0.8, Math.hypot(x, z));
        return Math.max(0, h - smoothstep(0.16, 0.05, river) * 0.08);
      };
  }
}

const PALETTES: Record<WorldTheme, Parameters<typeof layeredColor>[0]> = {
  starter: { floor: '#72cf5c', floor2: '#86d767', low: '#4f9fcf', mid: '#62bf52', high: '#4ea847', cliff: '#9b8a6c', highAt: 0.3 },
  canyon: { floor: '#d98f55', floor2: '#cf8350', low: '#8a5a38', mid: '#e3a162', high: '#eab073', cliff: '#b4552f', strata: '#e9b27d', highAt: 0.5 },
  frost: { floor: '#eef6ff', floor2: '#dbe9f6', low: '#9fc4e0', mid: '#e7f0fa', high: '#f4f8fc', cliff: '#8fa6c0', peak: '#ffffff', peakAt: 0.55, highAt: 0.5 },
  jungle: { floor: '#3f9a4b', floor2: '#4aa655', low: '#2f6f86', mid: '#378c43', high: '#2f7d3b', cliff: '#6b6f5f', highAt: 0.4 },
  skylab: { floor: '#d7deea', floor2: '#c7d0de', low: '#8190ab', mid: '#e2e8f0', high: '#eef2f8', cliff: '#7d8aa6', highAt: 0.2 },
  lava: { floor: '#3d3643', floor2: '#332d38', low: '#ff6a1a', mid: '#4a4250', high: '#57505e', cliff: '#2a232c', peak: '#6b3a2a', peakAt: 0.8, highAt: 0.9 },
};

const LOCKED = hex('#5d6b85');

/** Colour field per theme; locked worlds are desaturated towards slate. */
export function islandColor(theme: WorldTheme, locked: boolean): ColorFn {
  const base = layeredColor(PALETTES[theme], 41);
  const panel = hex('#b8c3d4');
  return (x, z, h, slope) => {
    let c = base(x, z, h, slope);
    if (theme === 'skylab' && (Math.floor(x * 3) + Math.floor(z * 3)) % 2 === 0) c = mixRgb(c, panel, 0.35);
    if (theme === 'lava') {
      const river = distToPolyline({ x, z }, ISLAND_CHANNELS.lava!);
      if (river < 0.13) c = mixRgb(c, hex('#ff7a1f'), 0.85);
    }
    if (theme === 'jungle' && distToPolyline({ x, z }, ISLAND_CHANNELS.jungle!) < 0.2) c = mixRgb(c, hex('#2f6f86'), 0.6);
    if (!locked) return c;
    const m = mixRgb(c, LOCKED, 0.38);
    return [m[0] * 0.82, m[1] * 0.82, m[2] * 0.82];
  };
}

/** Deterministic seed per world (shared by terrain, decor and pins). */
export const islandSeed = (order: number) => order * 17 + 5;

/** Local ground height under a point on the island (≥ 0). */
export const islandGround = (theme: WorldTheme, seed: number) => {
  const h = islandHeight(theme, seed);
  return (x: number, z: number) => (Math.hypot(x, z) > R ? 0 : Math.max(0, h(x, z)));
};

