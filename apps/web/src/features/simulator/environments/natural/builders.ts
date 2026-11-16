import type { PropBatch } from '../props/batch';

/*
 * Natural-look prop builders (Starter Island missions 1–3): trees and shrubs
 * built from many smooth leafy clusters with a leaf texture and bark trunks,
 * in the muted greens of real foliage. Pure — they append to a PropBatch like
 * every other builder, so a forest is still a handful of draw calls.
 */

type Rnd = () => number;
const TAU = Math.PI * 2;

/** Real-world summer foliage: muted, slightly yellow greens. */
export const FOLIAGE = {
  summer: ['#4d7a35', '#5a8a3c', '#68963f', '#436f33', '#577f2f'],
  birch: ['#7da347', '#8db152', '#6f9a40'],
  hedge: ['#3f6b2f', '#4a7834', '#38622a'],
  autumn: ['#b8862f', '#c4702b', '#a99a3a'],
} as const;

const pick = <T>(list: readonly T[], r: number): T => list[Math.floor(r * list.length) % list.length]!;

/** Shade a hex colour (k < 1 darker). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
}

/**
 * Top of a trunk of height `h` rotated by Euler XYZ (rx, ry, rz) about its
 * base — so the crown sits exactly on a leaning trunk.
 */
function trunkTop(h: number, rx: number, ry: number, rz: number): [number, number, number] {
  // R = Rx · Ry · Rz applied to (0, h, 0)
  let x = -Math.sin(rz) * h;
  let y = Math.cos(rz) * h;
  let z = 0;
  [x, z] = [Math.cos(ry) * x + Math.sin(ry) * z, -Math.sin(ry) * x + Math.cos(ry) * z];
  [y, z] = [Math.cos(rx) * y - Math.sin(rx) * z, Math.sin(rx) * y + Math.cos(rx) * z];
  return [x, y, z];
}

/**
 * Broadleaf tree: tapered, slightly leaning bark trunk with two limbs and a
 * crown of leaf clusters (darker underneath, lighter on top). The trunk runs
 * up into the crown and the crown is centred on the trunk's real top, so the
 * two never come apart (even with lean and wind).
 *
 * `castShadow = false` marks a background tree: no shadow, and 20-triangle
 * leaf clusters instead of 80 (it sits in the haze, the detail is not seen).
 */
export function broadleafTree(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, palette: readonly string[] = FOLIAGE.summer, castShadow = true) {
  const leaf = castShadow ? 'puff' : 'icosa';
  const lean = (rnd() - 0.5) * 0.12;
  const yaw = rnd() * TAU;
  const trunkH = 1.02 * s;
  const rot: [number, number, number] = [lean, yaw, lean * 0.6];
  const [tx, ty, tz] = trunkTop(trunkH, ...rot);
  b.add('cylinderLow', 'bark', { p: [x, y, z], r: rot, s: [0.075 * s, trunkH, 0.075 * s] }, castShadow);
  // Soft contact shadow where the tree meets the ground (every quality).
  b.add('disc', 'contact', { p: [x, y + 0.004, z], s: 0.95 * s }, false);
  // Root flare and limbs only on near trees (background trees are just trunk + crown).
  if (castShadow) b.add('cylinderLow', 'bark', { p: [x, y, z], r: [0, yaw, 0], s: [0.12 * s, 0.08 * s, 0.12 * s] });
  for (let i = 0; castShadow && i < 2; i++) {
    const a = yaw + i * Math.PI + rnd() * 0.6;
    // Limbs angle up from high on the trunk and end inside the crown (no bare stubs below it).
    b.add('cylinderLow', 'bark', { p: [x + tx * 0.6, y + 0.62 * s, z + tz * 0.6], r: [Math.cos(a) * 0.5, a, Math.sin(a) * 0.5], s: [0.028 * s, 0.33 * s, 0.028 * s] }, castShadow);
  }
  const base = pick(palette, rnd());
  // Crown centre a little below the trunk top: the trunk ends inside the leaves.
  const cx = x + tx;
  const cz = z + tz;
  const crownY = y + ty - 0.04 * s;
  // Base cluster wrapped around the trunk top.
  b.add(leaf, 'foliage', { p: [cx, crownY, cz], r: [rnd(), rnd() * TAU, rnd()], s: [0.42 * s, 0.34 * s, 0.42 * s], color: shade(base, 0.8) }, castShadow);
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const r = (0.12 + rnd() * 0.24) * s;
    const dy = (rnd() - 0.25) * 0.42 * s;
    const size = (0.34 + rnd() * 0.24) * s;
    const light = 0.78 + Math.max(0, dy / s) * 0.6 + rnd() * 0.12;
    b.add(leaf, 'foliage', { p: [cx + Math.cos(a) * r, crownY + dy, cz + Math.sin(a) * r], r: [rnd(), rnd() * TAU, rnd()], s: [size * 1.15, size * 0.9, size * 1.15], color: shade(rnd() < 0.7 ? base : pick(palette, rnd()), light) }, castShadow);
  }
  b.add(leaf, 'foliage', { p: [cx, crownY + 0.14 * s, cz], r: [0, rnd() * TAU, 0], s: [0.55 * s, 0.48 * s, 0.55 * s], color: shade(base, 0.95) }, castShadow);
}

/** Low rounded shrub: 3–5 leaf clusters hugging the ground. */
export function shrub(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, palette: readonly string[] = FOLIAGE.summer) {
  const n = 3 + Math.floor(rnd() * 3);
  // Small shrubs (bank scrub) use 20-triangle clusters; garden-sized ones the smooth 80.
  const leaf = s < 0.7 ? 'icosa' : 'puff';
  b.add('disc', 'contact', { p: [x, y + 0.004, z], s: 0.5 * s }, false);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const r = rnd() * 0.12 * s;
    const size = (0.16 + rnd() * 0.1) * s;
    b.add(leaf, 'foliage', { p: [x + Math.cos(a) * r, y + size * 0.55, z + Math.sin(a) * r], r: [rnd(), rnd() * TAU, rnd()], s: [size * 1.2, size, size * 1.2], color: shade(pick(palette, rnd()), 0.8 + rnd() * 0.3) });
  }
}

/** Clipped hedge segment (box body + leafy clusters on top and sides). */
export function hedgeRun(b: PropBatch, mx: number, mz: number, yaw: number, length: number, height: number, thickness: number, rnd: Rnd) {
  const col = pick(FOLIAGE.hedge, rnd());
  b.add('boxFloor', 'foliage', { p: [mx, 0, mz], r: yaw, s: [length + 0.02, height * 0.92, thickness], color: col });
  const n = Math.max(2, Math.round(length / 0.12));
  const ux = Math.cos(yaw);
  const uz = -Math.sin(yaw);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const px = mx + ux * t * length;
    const pz = mz + uz * t * length;
    b.add('icosa', 'foliage', { p: [px, height * 0.9, pz], r: [rnd(), rnd() * TAU, rnd()], s: [0.13, 0.08, thickness * 0.9], color: shade(col, 0.95 + rnd() * 0.2) });
  }
}

/** Wildflowers: tiny coloured heads on thin stems, in a loose drift. */
export function wildflowers(b: PropBatch, x: number, y: number, z: number, rnd: Rnd) {
  const colors = ['#f4d35e', '#ffffff', '#c9a7eb', '#f2a2b8'];
  const c = pick(colors, rnd());
  for (let i = 0; i < 6; i++) {
    const a = rnd() * TAU;
    const r = rnd() * 0.14;
    const h = 0.04 + rnd() * 0.04;
    b.add('boxFloor', 'tint', { p: [x + Math.cos(a) * r, y, z + Math.sin(a) * r], s: [0.004, h, 0.004], color: '#4f7a35' }, false);
    // Tiny heads: a 20-triangle icosahedron reads the same as a sphere at 1.4 cm.
    b.add('icosa', 'tint', { p: [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r], s: 0.014, color: rnd() < 0.8 ? c : pick(colors, rnd()) }, false);
  }
}

/** Natural boulder: grey stone with a slightly mossy top. */
export function boulder(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd) {
  b.add('disc', 'contact', { p: [x, y + 0.004, z], s: s * 1.5 }, false);
  b.add('dodeca', 'rock', { p: [x, y + s * 0.2, z], r: [rnd() * 0.6, rnd() * TAU, rnd() * 0.6], s: [s, s * (0.5 + rnd() * 0.3), s * (0.8 + rnd() * 0.3)] });
  if (rnd() < 0.6) b.add('icosa', 'foliage', { p: [x, y + s * 0.42, z], r: [0, rnd() * TAU, 0], s: [s * 0.6, s * 0.12, s * 0.6], color: '#5d7a3c' }, false);
}

/** Concrete planter box with a leafy shrub (natural replacement for `planter`). */
export function planterBox(b: PropBatch, x: number, y: number, z: number, rnd: Rnd, size = 0.3) {
  b.add('boxFloor', 'concrete', { p: [x, y, z], s: [size, 0.12, size] });
  b.add('boxFloor', 'tint', { p: [x, y + 0.115, z], s: [size * 0.86, 0.01, size * 0.86], color: '#4a3a2a' }, false);
  shrub(b, x, y + 0.12, z, size * 3, rnd);
}
