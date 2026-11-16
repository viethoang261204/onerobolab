import type { Vec2 } from '@robolab/shared';
import type { PropBatch } from './batch';

/*
 * Procedural prop primitives. Each builder appends low-poly parts to a
 * PropBatch — pure data, no three.js objects — so environments compose
 * hundreds of props into a few instanced draw calls. Units: metres,
 * `y` = ground height under the prop, `yaw` = rotation about +Y.
 */

type Rnd = () => number;

const TAU = Math.PI * 2;

// ── vegetation ───────────────────────────────────────────────────────────

export const LEAF = {
  green: ['#4cb35a', '#5cc466', '#3fa14e', '#6fcf6a'],
  lime: ['#8fd14f', '#a3dc5a', '#76c043'],
  jungle: ['#2e8b47', '#237a3c', '#3a9d52', '#1f6b34'],
  autumn: ['#e8a33a', '#d9772b', '#f0c24a'],
} as const;

const pick = <T>(list: readonly T[], r: number): T => list[Math.floor(r * list.length) % list.length]!;

/** Round-canopy tree (trunk + two canopies). */
export function tree(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, palette: readonly string[] = LEAF.green) {
  const color = pick(palette, rnd());
  b.add('cylinderLow', 'trunk', { p: [x, y, z], s: [0.09 * s, 0.5 * s, 0.09 * s] });
  b.add('icosa', 'tintFlat', { p: [x, y + 0.62 * s, z], r: rnd() * TAU, s: [0.62 * s, 0.52 * s, 0.62 * s], color });
  b.add('icosa', 'tintFlat', { p: [x + 0.08 * s, y + 0.92 * s, z - 0.05 * s], r: rnd() * TAU, s: [0.42 * s, 0.38 * s, 0.42 * s], color });
}

/** Tall jungle tree: thin trunk, layered wide canopy, a vine. */
export function jungleTree(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd) {
  const color = pick(LEAF.jungle, rnd());
  b.add('cylinderLow', 'trunk', { p: [x, y, z], r: rnd(), s: [0.1 * s, 1.5 * s, 0.1 * s] });
  b.add('cylinderLow', 'trunk', { p: [x, y, z], r: rnd(), s: [0.2 * s, 0.14 * s, 0.2 * s] });
  for (let i = 0; i < 3; i++) {
    const a = rnd() * TAU;
    const off = 0.18 * s;
    b.add('icosa', 'tintFlat', { p: [x + Math.cos(a) * off, y + (1.35 + i * 0.2) * s, z + Math.sin(a) * off], r: rnd() * TAU, s: [(0.8 - i * 0.15) * s, 0.32 * s, (0.8 - i * 0.15) * s], color: pick(LEAF.jungle, rnd()) });
  }
  b.add('cylinderLow', 'tintFlat', { p: [x + 0.25 * s, y + 0.55 * s, z], s: [0.012 * s, 0.85 * s, 0.012 * s], color: '#3f7f3a' }, false);
  void color;
}

/** Pine: three stacked cones, optionally snow-capped. */
export function pine(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, snowy = false) {
  const green = pick(['#2f6f5a', '#2b6650', '#377a60'], rnd());
  b.add('cylinderLow', 'trunk', { p: [x, y, z], s: [0.07 * s, 0.25 * s, 0.07 * s] });
  const layers: [number, number, number][] = [
    [0.18, 0.48, 0.55],
    [0.42, 0.37, 0.45],
    [0.64, 0.25, 0.36],
  ];
  layers.forEach(([dy, w, h], i) => {
    b.add('coneLow', 'tintFlat', { p: [x, y + dy * s, z], r: rnd() * TAU, s: [w * s, h * s, w * s], color: green });
    if (snowy) b.add('coneLow', 'tintFlat', { p: [x, y + (dy + h * 0.42) * s, z], r: rnd() * TAU, s: [w * 0.6 * s, h * 0.6 * s, w * 0.6 * s], color: i === 2 ? '#ffffff' : '#eef6ff' });
  });
}

export function bush(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, palette: readonly string[] = LEAF.green) {
  const color = pick(palette, rnd());
  b.add('icosa', 'tintFlat', { p: [x, y + 0.1 * s, z], r: rnd() * TAU, s: [0.34 * s, 0.26 * s, 0.34 * s], color });
  b.add('icosa', 'tintFlat', { p: [x + 0.12 * s, y + 0.08 * s, z + 0.06 * s], r: rnd() * TAU, s: [0.24 * s, 0.2 * s, 0.24 * s], color: pick(palette, rnd()) });
}

/** Low grass / fern tuft. */
export function tuft(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, color = '#5fae4c') {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + rnd();
    b.add('coneLow', 'tintFlat', { p: [x + Math.cos(a) * 0.03 * s, y, z + Math.sin(a) * 0.03 * s], r: [Math.cos(a) * 0.35, rnd() * TAU, Math.sin(a) * 0.35], s: [0.05 * s, 0.16 * s, 0.05 * s], color }, false);
  }
}

export function flowerPatch(b: PropBatch, x: number, y: number, z: number, rnd: Rnd) {
  const colors = ['#ffd84d', '#ff7aa8', '#ffffff', '#b28dff'];
  for (let i = 0; i < 5; i++) {
    const a = rnd() * TAU;
    const r = rnd() * 0.18;
    b.add('icosa', 'tintFlat', { p: [x + Math.cos(a) * r, y + 0.03, z + Math.sin(a) * r], s: 0.035, color: pick(colors, rnd()) }, false);
  }
}

export function rock(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, color = '#9aa0b5') {
  b.add('dodeca', 'tintFlat', { p: [x, y + s * 0.25, z], r: [rnd() * 0.6, rnd() * TAU, rnd() * 0.6], s: [s, s * (0.55 + rnd() * 0.3), s * (0.8 + rnd() * 0.3)], color });
}

export function cactus(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd) {
  const c = '#4f9a4a';
  b.add('cylinder', 'tintFlat', { p: [x, y + 0.28 * s, z], s: [0.09 * s, 0.56 * s, 0.09 * s], color: c });
  b.add('sphere', 'tintFlat', { p: [x, y + 0.56 * s, z], s: 0.09 * s, color: c });
  const side = rnd() > 0.5 ? 1 : -1;
  b.add('cylinder', 'tintFlat', { p: [x + 0.08 * side * s, y + 0.3 * s, z], r: [0, 0, side * 1.2], s: [0.06 * s, 0.14 * s, 0.06 * s], color: c });
  b.add('cylinder', 'tintFlat', { p: [x + 0.13 * side * s, y + 0.4 * s, z], s: [0.06 * s, 0.18 * s, 0.06 * s], color: c });
}

// ── street furniture ─────────────────────────────────────────────────────

/** Lamp post with a glowing head. */
export function lamp(b: PropBatch, x: number, y: number, z: number, yaw = 0, h = 0.9) {
  const f = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  b.add('cylinderLow', 'metalDark', { p: [x, y, z], s: [0.035, h, 0.035] });
  b.add('box', 'metalDark', { p: [x + f.x * 0.08, y + h, z + f.z * 0.08], r: yaw, s: [0.2, 0.025, 0.04] });
  b.add('box', 'glowWarm', { p: [x + f.x * 0.16, y + h - 0.03, z + f.z * 0.16], r: yaw, s: [0.09, 0.03, 0.07] }, false);
  b.add('cylinderLow', 'metalDark', { p: [x, y, z], s: [0.08, 0.04, 0.08] });
}

/** Signboard on two posts; `color` = board face, stripe glows. */
export function sign(b: PropBatch, x: number, y: number, z: number, yaw: number, color = '#2563eb', w = 0.36, h = 0.22) {
  const r = { x: Math.sin(yaw) * 0.5, z: Math.cos(yaw) * 0.5 };
  for (const k of [-1, 1]) b.add('cylinderLow', 'metalDark', { p: [x + r.x * w * k * 0.8, y, z + r.z * w * k * 0.8], s: [0.02, 0.3 + h, 0.02] });
  b.add('box', 'tintGlossy', { p: [x, y + 0.3 + h / 2, z], r: yaw, s: [0.02, h, w], color });
  b.add('box', 'glowCyan', { p: [x + Math.cos(yaw) * 0.012, y + 0.3 + h * 0.2, z - Math.sin(yaw) * 0.012], r: yaw, s: [0.004, 0.02, w * 0.8] }, false);
}

/** Small warning triangle on a post. */
export function warningSign(b: PropBatch, x: number, y: number, z: number, yaw: number) {
  b.add('cylinderLow', 'metalDark', { p: [x, y, z], s: [0.02, 0.34, 0.02] });
  b.add('coneLow', 'tintGlossy', { p: [x, y + 0.34, z], r: [Math.PI / 2, yaw, 0], s: [0.12, 0.02, 0.12], color: '#facc15' });
}

export function bench(b: PropBatch, x: number, y: number, z: number, yaw: number) {
  b.add('box', 'wood', { p: [x, y + 0.1, z], r: yaw, s: [0.36, 0.025, 0.12] });
  b.add('box', 'wood', { p: [x - Math.sin(yaw) * 0.055, y + 0.17, z - Math.cos(yaw) * 0.055], r: yaw, s: [0.36, 0.09, 0.02] });
  for (const k of [-1, 1]) b.add('box', 'metalDark', { p: [x + Math.cos(yaw) * 0.15 * k, y + 0.05, z - Math.sin(yaw) * 0.15 * k], r: yaw, s: [0.02, 0.1, 0.12] });
}

export function planter(b: PropBatch, x: number, y: number, z: number, rnd: Rnd, size = 0.3) {
  b.add('boxFloor', 'concrete', { p: [x, y, z], s: [size, 0.12, size] });
  bush(b, x, y + 0.12, z, size * 1.6, rnd);
}

// ── crates, barrels, containers ──────────────────────────────────────────

export function crate(b: PropBatch, x: number, y: number, z: number, s: number, yaw: number, color = '#c98a4b') {
  b.add('boxFloor', 'tint', { p: [x, y, z], r: yaw, s: [s, s, s], color });
  b.add('boxFloor', 'woodDark', { p: [x, y - 0.001, z], r: yaw, s: [s * 1.02, s * 1.01, s * 0.18] });
  b.add('boxFloor', 'woodDark', { p: [x, y - 0.001, z], r: yaw, s: [s * 0.18, s * 1.01, s * 1.02] });
}

export function barrel(b: PropBatch, x: number, y: number, z: number, s: number, color = '#2563eb') {
  b.add('cylinderFloor', 'tintMetal', { p: [x, y, z], s: [0.14 * s, 0.22 * s, 0.14 * s], color });
  b.add('cylinderFloor', 'metalDark', { p: [x, y + 0.06 * s, z], s: [0.145 * s, 0.015 * s, 0.145 * s] });
  b.add('cylinderFloor', 'metalDark', { p: [x, y + 0.16 * s, z], s: [0.145 * s, 0.015 * s, 0.145 * s] });
}

export function container(b: PropBatch, x: number, y: number, z: number, yaw: number, color = '#d9573b', s = 1) {
  b.add('boxFloor', 'tintMetal', { p: [x, y, z], r: yaw, s: [1.2 * s, 0.5 * s, 0.5 * s], color });
  for (let i = -2; i <= 2; i++) {
    const o = i * 0.24 * s;
    b.add('boxFloor', 'tintMetal', { p: [x + Math.cos(yaw) * o, y, z - Math.sin(yaw) * o], r: yaw, s: [0.03 * s, 0.51 * s, 0.51 * s], color });
  }
}

export function tank(b: PropBatch, x: number, y: number, z: number, r: number, h: number, color = '#dfe4ee') {
  b.add('cylinderFloor', 'tintMetal', { p: [x, y, z], s: [r * 2, h, r * 2], color });
  b.add('sphere', 'tintMetal', { p: [x, y + h, z], s: [r * 2, r * 0.9, r * 2], color });
  b.add('cylinderFloor', 'glowAmber', { p: [x, y + h * 0.7, z], s: [r * 2.02, 0.03, r * 2.02] }, false);
}

/** Pipe between two 3D points. */
export function pipe(b: PropBatch, from: readonly [number, number, number], to: readonly [number, number, number], radius: number, color = '#b7c2d6') {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  const horiz = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dz, dx);
  const tilt = Math.atan2(horiz, dy); // 0 = vertical
  b.add('cylinder', 'tintMetal', { p: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], r: [0, yaw, -tilt], s: [radius * 2, len, radius * 2], color });
}

// ── structures ───────────────────────────────────────────────────────────

/** Small lab / service building: body, roof slab, glowing window band, door. */
export function building(b: PropBatch, x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, body = '#eef2f8', accent: 'glowCyan' | 'glowWarm' | 'glowAmber' = 'glowCyan') {
  const f = { x: Math.sin(yaw), z: Math.cos(yaw) };
  b.add('boxFloor', 'tint', { p: [x, y - 0.3, z], r: yaw, s: [w, h + 0.3, d], color: body });
  b.add('boxFloor', 'metalDark', { p: [x, y + h, z], r: yaw, s: [w * 1.06, 0.06, d * 1.06] });
  b.add('box', accent, { p: [x + f.x * (d / 2 + 0.004), y + h * 0.62, z + f.z * (d / 2 + 0.004)], r: yaw, s: [w * 0.8, h * 0.18, 0.01] }, false);
  b.add('box', 'glass', { p: [x + f.x * (d / 2 + 0.005), y + h * 0.22, z + f.z * (d / 2 + 0.005)], r: yaw, s: [w * 0.22, h * 0.42, 0.01] }, false);
}

/** Robot charging station: pad, two pylons, energy core (static parts). */
export function chargingStation(b: PropBatch, x: number, y: number, z: number, yaw: number, s = 1) {
  b.add('hexFloor', 'metal', { p: [x, y, z], r: yaw, s: [0.5 * s, 0.03, 0.5 * s] });
  b.add('hexFloor', 'glowCyan', { p: [x, y + 0.001, z], r: yaw, s: [0.34 * s, 0.034, 0.34 * s] }, false);
  for (const k of [-1, 1]) {
    const px = x + Math.sin(yaw) * 0.22 * k * s;
    const pz = z + Math.cos(yaw) * 0.22 * k * s;
    b.add('boxFloor', 'tint', { p: [px, y, pz], r: yaw, s: [0.06 * s, 0.34 * s, 0.06 * s], color: '#f8fafc' });
    b.add('boxFloor', 'glowCyan', { p: [px, y + 0.27 * s, pz], r: yaw, s: [0.065 * s, 0.04 * s, 0.065 * s] }, false);
  }
}

/** Tall beacon mast with ring lights. */
export function beaconMast(b: PropBatch, x: number, y: number, z: number, h: number, glow: 'glowRed' | 'glowCyan' | 'glowAmber' = 'glowRed') {
  b.add('cylinderLow', 'metal', { p: [x, y, z], s: [0.05, h, 0.05] });
  b.add('cylinderLow', 'metalDark', { p: [x, y, z], s: [0.16, 0.06, 0.16] });
  for (let i = 1; i <= 3; i++) b.add('cylinderLow', 'metalDark', { p: [x, y + (h * i) / 3.4, z], s: [0.09, 0.02, 0.09] });
  b.add('sphere', glow, { p: [x, y + h + 0.03, z], s: 0.07 }, false);
}

export function radarDish(b: PropBatch, x: number, y: number, z: number, yaw: number, s = 1) {
  b.add('boxFloor', 'metalDark', { p: [x, y, z], r: yaw, s: [0.3 * s, 0.12 * s, 0.3 * s] });
  b.add('cylinderLow', 'metal', { p: [x, y + 0.12 * s, z], s: [0.05 * s, 0.35 * s, 0.05 * s] });
  b.add('sphere', 'tintMetal', { p: [x, y + 0.55 * s, z], r: [0.9, yaw, 0], s: [0.5 * s, 0.14 * s, 0.5 * s], color: '#f1f5f9' });
  b.add('sphere', 'glowRed', { p: [x, y + 0.72 * s, z], s: 0.03 * s }, false);
}

/** Ruined stone pillar (optionally broken). */
export function pillar(b: PropBatch, x: number, y: number, z: number, h: number, rnd: Rnd) {
  b.add('boxFloor', 'tintFlat', { p: [x, y, z], s: [0.22, 0.08, 0.22], color: '#8f9a8c' });
  b.add('cylinderLow', 'tintFlat', { p: [x, y + 0.08, z], r: rnd(), s: [0.15, h, 0.15], color: '#a3ab9c' });
  b.add('icosa', 'tintFlat', { p: [x, y + 0.08 + h, z], s: [0.14, 0.06, 0.14], color: '#5d8a4f' });
}

/** Stepped temple ruin. */
export function temple(b: PropBatch, x: number, y: number, z: number, yaw: number, s: number) {
  const steps: [number, number][] = [
    [1.6, 0.3],
    [1.2, 0.3],
    [0.85, 0.3],
    [0.5, 0.36],
  ];
  let top = y;
  steps.forEach(([w, h], i) => {
    b.add('boxFloor', 'tintFlat', { p: [x, top, z], r: yaw, s: [w * s, h * s, w * s], color: i % 2 ? '#9aa391' : '#a9b19f' });
    top += h * s;
  });
  b.add('boxFloor', 'glowGreen', { p: [x, top, z], r: yaw, s: [0.16 * s, 0.14 * s, 0.16 * s] }, false);
  // moss on the ledges
  steps.slice(0, 3).forEach(([w], i) => b.add('box', 'tintFlat', { p: [x, y + (i + 1) * 0.3 * s, z], r: yaw, s: [w * s * 1.01, 0.02, w * s * 0.35], color: '#5d8a4f' }, false));
}

/** Warehouse rack along +X from (x, z), `length` m long. */
export function shelfRack(b: PropBatch, x: number, z: number, length: number, yaw: number, rnd: Rnd, depth = 0.34, height = 1.0) {
  const c = Math.cos(yaw);
  const sn = -Math.sin(yaw);
  const at = (t: number, o = 0) => [x + c * t - sn * o, z + sn * t + c * o] as const;
  const bays = Math.max(1, Math.round(length / 0.5));
  for (let i = 0; i <= bays; i++) {
    const [px, pz] = at((i / bays) * length - length / 2);
    for (const o of [-depth / 2, depth / 2]) {
      const [qx, qz] = [px - sn * o, pz + c * o];
      b.add('boxFloor', 'tintMetal', { p: [qx, 0, qz], r: yaw, s: [0.03, height, 0.03], color: '#2563eb' });
    }
  }
  for (const lv of [0.05, 0.38, 0.7]) {
    const [mx, mz] = at(0);
    b.add('boxFloor', 'tintMetal', { p: [mx, lv * height, mz], r: yaw, s: [length, 0.03, depth], color: '#f59e0b' });
    // goods
    for (let i = 0; i < bays; i++) {
      if (rnd() < 0.2) continue;
      const [gx, gz] = at(((i + 0.5) / bays) * length - length / 2, (rnd() - 0.5) * 0.06);
      const s = 0.16 + rnd() * 0.1;
      if (rnd() < 0.7) crate(b, gx, lv * height + 0.03, gz, s, yaw + (rnd() - 0.5) * 0.2, pick(['#c98a4b', '#d9a066', '#b87a3e'], rnd()));
      else barrel(b, gx, lv * height + 0.03, gz, 0.9, pick(['#2563eb', '#dc2626', '#16a34a'], rnd()));
    }
  }
}

/** Energy gate frame (two pillars and a beam); the animated field is a separate component. */
export function gateFrame(b: PropBatch, x: number, y: number, z: number, yaw: number, width: number, height: number, glow: 'glowCyan' | 'glowPurple' | 'glowAmber' = 'glowCyan') {
  const r = { x: Math.sin(yaw), z: Math.cos(yaw) };
  for (const k of [-1, 1]) {
    const px = x + r.x * (width / 2) * k;
    const pz = z + r.z * (width / 2) * k;
    b.add('boxFloor', 'metal', { p: [px, y, pz], r: yaw, s: [0.1, height, 0.1] });
    b.add('boxFloor', glow, { p: [px, y + height * 0.15, pz], r: yaw, s: [0.105, height * 0.7, 0.03] }, false);
  }
  b.add('boxFloor', 'metal', { p: [x, y + height, z], r: yaw, s: [0.12, 0.08, width + 0.1] });
}

// ── linear features ──────────────────────────────────────────────────────

/** Evenly spaced points along a segment (inclusive ends). */
export function along(a: Vec2, c: Vec2, spacing: number): Vec2[] {
  const len = Math.hypot(c.x - a.x, c.z - a.z);
  const n = Math.max(1, Math.round(len / spacing));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((c.x - a.x) * i) / n, z: a.z + ((c.z - a.z) * i) / n }));
}

/** Rustic wooden fence along a segment. */
export function fence(b: PropBatch, a: Vec2, c: Vec2, y = 0, h = 0.16) {
  const yaw = Math.atan2(-(c.z - a.z), c.x - a.x);
  const len = Math.hypot(c.x - a.x, c.z - a.z);
  for (const p of along(a, c, 0.34)) b.add('boxFloor', 'wood', { p: [p.x, y, p.z], r: yaw, s: [0.035, h + 0.03, 0.035] });
  const mid = { x: (a.x + c.x) / 2, z: (a.z + c.z) / 2 };
  for (const k of [0.45, 0.85]) b.add('box', 'wood', { p: [mid.x, y + h * k, mid.z], r: yaw, s: [len, 0.022, 0.018] });
}

// ── helpers ──────────────────────────────────────────────────────────────

/**
 * Up to `count` random points in [-half, half]² accepted by `ok`
 * (deterministic for a given rnd).
 */
export function scatter(rnd: Rnd, count: number, half: number, ok: (x: number, z: number) => boolean, tries = 12): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < tries; t++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      if (ok(x, z)) {
        out.push({ x, z });
        break;
      }
    }
  }
  return out;
}
