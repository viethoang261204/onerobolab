import { clamp01, fbm, hex, mixRgb, smoothstep, type Rgb } from '../../simulator/environments/terrain/fields';
import type { AdventureLayout, RegionFlavor } from '../adventure.types';
import { WATER_Y } from '../layout';
import { ISLAND_THEMES } from './island-theme';

/*
 * The island's ground as pure functions of (x, z): terraces that follow the
 * road's height (each road section a step higher, so neighbouring terraces
 * meet in cliffs), hills and ridges away from the road, a coastline that
 * drops to the sea, and the river gorge. Also the colouring.
 */

/** Distance within which the ground is flat at road height (the road bed). */
const ROAD_BED = 1.15;
const SEA_FLOOR = -1.5;
const SPECKLE: Rgb = [1, 0.93, 0.6];
const shadeRgb = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

const HILLS: Readonly<Record<RegionFlavor, number>> = { base: 0.3, tech: 0.45, meadow: 1.1, forest: 1.5, river: 0.8, rocky: 2.4, arena: 0.6 };

export interface Nearest {
  readonly i: number;
  readonly d: number;
}

export interface IslandGround {
  readonly height: (x: number, z: number) => number;
  readonly color: (x: number, z: number, h: number, slope: number) => Rgb;
  /** Nearest road point (index into layout.route) and its distance. */
  readonly nearest: (x: number, z: number) => Nearest;
  /** Distance to the river centre line (Infinity without one). */
  readonly riverDist: (x: number, z: number) => number;
}

export function islandGround(layout: AdventureLayout): IslandGround {
  const { route, routeY, routeRegion, regions, seed } = layout;
  const theme = ISLAND_THEMES[layout.theme];
  // Coarse copy of the road for the nearest-point search, refined locally.
  const STRIDE = 3;
  const coarse: number[] = [];
  for (let i = 0; i < route.length; i += STRIDE) coarse.push(i);
  const river = layout.crossing?.river ?? null;

  const nearest = (x: number, z: number): Nearest => {
    let best = 0;
    let bd = Infinity;
    for (const i of coarse) {
      const p = route[i]!;
      const d = (p.x - x) ** 2 + (p.y - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    for (let i = Math.max(0, best - STRIDE); i <= Math.min(route.length - 1, best + STRIDE); i++) {
      const p = route[i]!;
      const d = (p.x - x) ** 2 + (p.y - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return { i: best, d: Math.sqrt(bd) };
  };

  const riverDist = (x: number, z: number): number => {
    if (!river) return Infinity;
    let bd = Infinity;
    for (let i = 0; i < river.length; i += 2) {
      const p = river[i]!;
      const d = (p.x - x) ** 2 + (p.y - z) ** 2;
      if (d < bd) bd = d;
    }
    return Math.sqrt(bd);
  };

  const coastR = (x: number, z: number) => 5.4 + fbm(x * 0.11, z * 0.11, seed + 9, 3) * 1.9;

  const height = (x: number, z: number): number => {
    const { i, d } = nearest(x, z);
    const road = routeY[i]!;
    const flavor = regions[routeRegion[i]!]?.flavor ?? 'meadow';
    const away = smoothstep(ROAD_BED, 3.4, d);
    const n = fbm(x * 0.23, z * 0.23, seed, 4) * 0.5 + 0.5;
    let h = road + away * (0.18 + HILLS[flavor] * n);
    if (flavor === 'rocky' || flavor === 'forest') {
      const ridge = Math.max(0, fbm(x * 0.17 + 7, z * 0.17, seed + 3, 3));
      h += away * ridge * (flavor === 'rocky' ? 3.4 : 1.6);
    }
    // Coast: steep drop to the sea floor.
    const c = coastR(x, z);
    h += (SEA_FLOOR - h) * smoothstep(c - 0.2, c + 1.1, d);
    // River gorge down to the water — never under the road, except at the bridge.
    if (river) {
      const r = riverDist(x, z);
      const bridge = layout.crossing!.bridge;
      const underBridge = (x - bridge.x) ** 2 + (z - bridge.y) ** 2 < 2.4 * 2.4;
      const keepRoad = underBridge ? 1 : smoothstep(ROAD_BED, ROAD_BED + 0.7, d);
      if (r < 2.2) h += (WATER_Y - 0.55 - h) * (1 - smoothstep(0.75, 2.1, r)) * keepRoad;
    }
    return h;
  };

  const ground = Object.fromEntries(Object.entries(theme.ground).map(([k, v]) => [k, hex(v)])) as Record<RegionFlavor, Rgb>;
  const ground2 = hex(theme.ground2);
  const cliff = hex(theme.cliff);
  const strata = hex(theme.strata);
  const sand = hex(theme.sand);
  const seabed = hex(theme.seabed);
  const peak = theme.peak ? hex(theme.peak) : null;
  const rockTone = hex(theme.rock);

  const color = (x: number, z: number, h: number, slope: number): Rgb => {
    const { i } = nearest(x, z);
    const road = routeY[i]!;
    const flavor = regions[routeRegion[i]!]?.flavor ?? 'meadow';
    const n = fbm(x * 0.4, z * 0.4, seed + 5, 3);
    let c: Rgb = mixRgb(ground[flavor], ground2, clamp01(n * 0.9 + 0.35));
    // Natural patchiness: darker turf, sunlit patches and flower speckles.
    const patch = fbm(x * 0.9 + 3, z * 0.9, seed + 11, 2);
    if (patch > 0.15) c = mixRgb(c, shadeRgb(ground[flavor], 0.78), clamp01((patch - 0.15) * 2.2) * 0.6);
    else if (patch < -0.3) c = mixRgb(c, ground2, 0.35);
    if ((flavor === 'meadow' || flavor === 'base') && fbm(x * 3.1, z * 3.1, seed + 17, 1) > 0.55) c = mixRgb(c, SPECKLE, 0.45);
    if (flavor === 'rocky') c = mixRgb(c, rockTone, clamp01(smoothstep(0.4, 2.2, h - road) * 0.8));
    if (h < WATER_Y + 0.35) c = mixRgb(sand, seabed, smoothstep(WATER_Y + 0.1, WATER_Y - 0.9, h));
    if (slope > 0.55) {
      const band = Math.sin(h * 7 + n * 2) > 0.3 ? strata : cliff;
      c = mixRgb(c, band, smoothstep(0.55, 1.1, slope));
    }
    if (peak && h - road > 1.6) c = mixRgb(c, peak, smoothstep(1.6, 2.4, h - road) * (slope < 1.2 ? 0.9 : 0.4));
    const k = 1 + n * 0.08;
    return [c[0] * k, c[1] * k, c[2] * k];
  };

  return { height, color, nearest, riverDist };
}
