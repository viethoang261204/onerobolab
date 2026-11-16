import type { Vec2 } from '@robolab/shared';
import type { SceneWater } from '../../../../content/levels/types';

/*
 * Terrain maths — pure functions (tested, no three.js). An environment
 * describes its landscape as a height field + colour field; `Terrain`
 * turns them into one vertex-coloured mesh.
 */

export type Rgb = readonly [number, number, number];
export type HeightFn = (x: number, z: number) => number;
/** Colour for a terrain vertex (sRGB 0–1) from position, height and slope (0 = flat, 1 = 45°+). */
export type ColorFn = (x: number, z: number, h: number, slope: number) => Rgb;

export interface TerrainField {
  readonly height: HeightFn;
  readonly color: ColorFn;
  /** Square side (m), centred on the origin. */
  readonly size: number;
}

// ── noise ────────────────────────────────────────────────────────────────

const hash = (x: number, z: number, seed: number) => {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const fade = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise in [-1, 1]. */
export function valueNoise(x: number, z: number, seed = 1): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = fade(x - xi);
  const fz = fade(z - zi);
  const a = hash(xi, zi, seed);
  const b = hash(xi + 1, zi, seed);
  const c = hash(xi, zi + 1, seed);
  const d = hash(xi + 1, zi + 1, seed);
  return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * 2 - 1;
}

/** Fractal noise (sum of octaves), roughly in [-1, 1]. */
export function fbm(x: number, z: number, seed = 1, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

// ── shaping ──────────────────────────────────────────────────────────────

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smoothstep = (e0: number, e1: number, v: number) => fade(clamp01((v - e0) / (e1 - e0)));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = clamp01(((p.x - a.x) * dx + (p.z - a.z) * dz) / len2);
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

export function distToPolyline(p: Vec2, pts: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i]!, pts[i + 1]!));
  return best;
}

/** Distance outside an origin-centred rectangle (0 inside). */
export const outsideRect = (x: number, z: number, hx: number, hz: number) => Math.hypot(Math.max(0, Math.abs(x) - hx), Math.max(0, Math.abs(z) - hz));

/** Channel bed below each water surface; banks slope over `bank` metres. */
export function carveWater(h: number, x: number, z: number, water: readonly SceneWater[] | undefined, bank = 0.14): number {
  if (!water) return h;
  let out = h;
  for (const w of water) {
    const d = distToPolyline({ x, z }, w.points);
    const half = w.width / 2;
    if (d > half + bank) continue;
    const bed = -(w.depth + 0.16);
    const t = smoothstep(half + bank, half * 0.55, d);
    out = Math.min(out, lerp(Math.min(h, 0), bed, t));
  }
  return out;
}

// ── colour ───────────────────────────────────────────────────────────────

const cache = new Map<string, Rgb>();
export function hex(c: string): Rgb {
  let v = cache.get(c);
  if (!v) {
    const n = parseInt(c.slice(1), 16);
    v = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    cache.set(c, v);
  }
  return v;
}

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const shade = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

export interface TerrainPalette {
  /** Level ground (lawn, sand, snow, forest floor). */
  readonly floor: string;
  /** Second ground tone for patchy variation. */
  readonly floor2: string;
  /** Below the floor (river beds, wet banks). */
  readonly low: string;
  /** Raised ground (hills, mounds). */
  readonly mid: string;
  /** High ground / plateaus. */
  readonly high: string;
  /** Steep faces. */
  readonly cliff: string;
  /** Optional caps above `peakAt` (snow). */
  readonly peak?: string;
  readonly peakAt?: number;
  /** Height where `high` takes over from `mid`. */
  readonly highAt?: number;
  /** Horizontal bands on cliffs (canyon strata). */
  readonly strata?: string;
}

/** Height/slope layered colouring with subtle noise variation. */
export function layeredColor(p: TerrainPalette, seed = 3): ColorFn {
  const floor = hex(p.floor);
  const floor2 = hex(p.floor2);
  const low = hex(p.low);
  const mid = hex(p.mid);
  const high = hex(p.high);
  const cliff = hex(p.cliff);
  const peak = p.peak ? hex(p.peak) : null;
  const strata = p.strata ? hex(p.strata) : null;
  const highAt = p.highAt ?? 1.2;
  const peakAt = p.peakAt ?? 99;
  return (x, z, h, slope) => {
    const n = fbm(x * 0.35, z * 0.35, seed, 3);
    let c: Rgb;
    if (h < -0.04) c = mixRgb(low, cliff, smoothstep(-0.2, -1.2, h) * 0.5);
    else if (h < 0.06) c = mixRgb(floor, floor2, clamp01(n * 1.4 + 0.5));
    else c = mixRgb(mixRgb(floor2, mid, smoothstep(0.06, 0.5, h)), high, smoothstep(highAt * 0.6, highAt, h));
    if (slope > 0.45) {
      let face = cliff;
      if (strata && Math.sin(h * 9) > 0.35) face = mixRgb(cliff, strata, 0.55);
      c = mixRgb(c, face, smoothstep(0.45, 0.85, slope));
    }
    if (peak && h > peakAt) c = mixRgb(c, peak, smoothstep(peakAt, peakAt + 0.6, h) * (slope < 0.9 ? 1 : 0.5));
    return shade(c, 1 + n * 0.07);
  };
}
