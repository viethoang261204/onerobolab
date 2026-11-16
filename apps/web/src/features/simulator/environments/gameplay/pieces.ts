import type { MapEntityOf, Vec2 } from '@robolab/shared';
import type { SceneBridge } from '../../../../content/levels/types';
import { seededRandom } from '../../environment/geometry';
import type { PropBatch } from '../props/batch';
import { along, barrel, bush, crate, fence, LEAF, pipe, rock, shelfRack } from '../props/builders';
import { hedgeRun } from '../natural/builders';

/*
 * Map entities → themed 3D pieces. Colliders come from the map (physics);
 * this only decides how they look. The id prefix before the first "-"
 * selects the style ("hedge-a1" → hedge, "cone-3" → cone).
 */

export type WallStyle = 'barrier' | 'hedge' | 'fence' | 'rail' | 'woodRail' | 'rope' | 'cliff' | 'shelf' | 'ice' | 'log' | 'door';

const WALL_PREFIX: Record<string, WallStyle> = {
  hedge: 'hedge',
  fence: 'fence',
  rail: 'barrier',
  cliff: 'cliff',
  shelf: 'shelf',
  ice: 'ice',
  log: 'log',
  dock: 'door',
};

const BRIDGE_RAIL: Record<SceneBridge['style'], WallStyle> = { wood: 'woodRail', steel: 'rail', rope: 'rope', log: 'rope' };

export const prefixOf = (id: string) => id.split('-')[0] ?? id;

/** Style of a wall piece: on a bridge it becomes that bridge's railing. */
export function wallStyleAt(wallId: string, p: Vec2, bridges: readonly SceneBridge[] = []): WallStyle {
  for (const b of bridges) if (onBridge(p, b, 0.12)) return BRIDGE_RAIL[b.style];
  return WALL_PREFIX[prefixOf(wallId)] ?? 'barrier';
}

/** Point within a bridge deck rectangle (+margin across). */
export function onBridge(p: Vec2, b: SceneBridge, margin = 0): boolean {
  const dx = b.to.x - b.from.x;
  const dz = b.to.z - b.from.z;
  const len = Math.hypot(dx, dz) || 1;
  const t = ((p.x - b.from.x) * dx + (p.z - b.from.z) * dz) / (len * len);
  if (t < 0 || t > 1) return false;
  const across = Math.abs((p.x - b.from.x) * (-dz / len) + (p.z - b.from.z) * (dx / len));
  return across <= b.width / 2 + margin;
}

const HEDGE = ['#3f9a4b', '#4aa556', '#378a43'] as const;

/** Wall → pieces. Long walls are cut into ~0.3 m modules so style can change along them (bridges). */
/** `natural`: hedges become leafy clipped hedges (natural look). */
export function wallPieces(b: PropBatch, w: MapEntityOf<'wall'>, bridges: readonly SceneBridge[], natural = false) {
  const dx = w.to.x - w.from.x;
  const dz = w.to.z - w.from.z;
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dz, dx);
  const rnd = seededRandom(hashId(String(w.id)));
  const baseStyle = wallStyleAt(String(w.id), { x: (w.from.x + w.to.x) / 2, z: (w.from.z + w.to.z) / 2 }, []);
  if (baseStyle === 'shelf') {
    shelfRack(b, (w.from.x + w.to.x) / 2, (w.from.z + w.to.z) / 2, length, yaw, rnd, Math.max(0.3, w.thickness), 0.62);
    return;
  }
  const count = Math.max(1, Math.round(length / 0.3));
  const seg = length / count;
  for (let i = 0; i < count; i++) {
    const t0 = i / count;
    const t1 = (i + 1) / count;
    const a = { x: w.from.x + dx * t0, z: w.from.z + dz * t0 };
    const c = { x: w.from.x + dx * t1, z: w.from.z + dz * t1 };
    const m = { x: (a.x + c.x) / 2, z: (a.z + c.z) / 2 };
    const style = wallStyleAt(String(w.id), m, bridges);
    if (natural && style === 'hedge') hedgeRun(b, m.x, m.z, yaw, seg, w.height, w.thickness, rnd);
    else piece(b, style, a, c, m, seg, yaw, w, rnd);
  }
}

function piece(b: PropBatch, style: WallStyle, a: Vec2, c: Vec2, m: Vec2, seg: number, yaw: number, w: MapEntityOf<'wall'>, rnd: () => number) {
  const h = w.height;
  const t = w.thickness;
  switch (style) {
    case 'barrier':
      b.add('boxFloor', 'hazard', { p: [m.x, 0, m.z], r: yaw, s: [seg - 0.012, h, t] });
      b.add('boxFloor', 'metal', { p: [m.x, h, m.z], r: yaw, s: [seg - 0.012, 0.012, t * 1.15] });
      break;
    case 'hedge':
      b.add('boxFloor', 'tintFlat', { p: [m.x, 0, m.z], r: yaw, s: [seg + 0.02, h, t], color: HEDGE[Math.floor(rnd() * 3)]! });
      b.add('icosa', 'tintFlat', { p: [m.x, h, m.z], r: rnd() * 6, s: [seg * 0.7, 0.1, t * 1.1], color: HEDGE[Math.floor(rnd() * 3)]! });
      break;
    case 'fence':
      fence(b, a, c, 0, Math.max(0.14, h));
      break;
    case 'rail':
      b.add('boxFloor', 'metal', { p: [a.x, 0, a.z], r: yaw, s: [0.03, h + 0.04, 0.03] });
      b.add('box', 'tintMetal', { p: [m.x, h + 0.03, m.z], r: yaw, s: [seg, 0.02, 0.025], color: '#f59e0b' });
      b.add('box', 'metal', { p: [m.x, h * 0.5, m.z], r: yaw, s: [seg, 0.012, 0.012] });
      b.add('box', 'glowAmber', { p: [a.x, h + 0.05, a.z], r: yaw, s: [0.035, 0.012, 0.035] }, false);
      break;
    case 'woodRail':
      b.add('boxFloor', 'woodDark', { p: [a.x, 0, a.z], r: yaw, s: [0.035, h + 0.05, 0.035] });
      b.add('box', 'wood', { p: [m.x, h + 0.03, m.z], r: yaw, s: [seg, 0.025, 0.03] });
      break;
    case 'rope':
      b.add('boxFloor', 'trunk', { p: [a.x, 0, a.z], r: yaw, s: [0.04, h + 0.06, 0.04] });
      b.add('box', 'tint', { p: [m.x, h + 0.02, m.z], r: yaw, s: [seg, 0.012, 0.012], color: '#d9c49a' }, false);
      b.add('box', 'tint', { p: [m.x, h * 0.5, m.z], r: yaw, s: [seg, 0.01, 0.01], color: '#d9c49a' }, false);
      break;
    case 'cliff':
      rock(b, m.x, -0.02, m.z, 0.11 + rnd() * 0.1, rnd, rnd() < 0.5 ? '#c26a3d' : '#a8552f');
      break;
    case 'ice':
      b.add('boxFloor', 'ice', { p: [m.x, 0, m.z], r: yaw + (rnd() - 0.5) * 0.08, s: [seg - 0.02, h + rnd() * 0.08, t] });
      b.add('boxFloor', 'tint', { p: [m.x, h + 0.02, m.z], r: yaw, s: [seg - 0.04, 0.03, t * 0.9], color: '#ffffff' }, false);
      break;
    case 'log':
      b.add('cylinder', 'trunk', { p: [m.x, 0.06, m.z], r: [0, yaw, Math.PI / 2], s: [0.12, seg + 0.04, 0.12] });
      if (rnd() < 0.55) bush(b, m.x + Math.sin(yaw) * 0.08, 0.05, m.z + Math.cos(yaw) * 0.08, 0.5, rnd, LEAF.jungle);
      break;
    case 'door':
      b.add('boxFloor', 'tintMetal', { p: [m.x, 0, m.z], r: yaw, s: [seg + 0.01, 0.75, t], color: '#94a3b8' });
      b.add('boxFloor', 'hazard', { p: [m.x, 0, m.z], r: yaw, s: [seg + 0.012, 0.08, t * 1.1] });
      b.add('box', 'metalDark', { p: [m.x, 0.3, m.z], r: yaw, s: [seg, 0.015, t * 1.05] });
      b.add('box', 'metalDark', { p: [m.x, 0.55, m.z], r: yaw, s: [seg, 0.015, t * 1.05] });
      break;
    case 'shelf':
      break;
  }
}

/** Obstacles: `cone` (default), `rock`, `stump`, `barrel`, `post`. */
export function obstaclePiece(b: PropBatch, o: MapEntityOf<'obstacle'>) {
  const { x, z } = o.position;
  const r = o.radius;
  const h = o.height;
  const rnd = seededRandom(hashId(String(o.id)));
  switch (prefixOf(String(o.id))) {
    case 'rock':
      rock(b, x, -0.01, z, r * 2.1, rnd, '#8d9488');
      break;
    case 'stump':
      b.add('cylinderLow', 'trunk', { p: [x, 0, z], s: [r * 2, h, r * 2] });
      b.add('cylinderLow', 'wood', { p: [x, h, z], s: [r * 1.8, 0.01, r * 1.8] });
      break;
    case 'barrel':
      barrel(b, x, 0, z, (r / 0.07) * 1, '#dc2626');
      break;
    default:
      b.add('boxFloor', 'metalDark', { p: [x, 0, z], s: [r * 2.6, h * 0.08, r * 2.6] });
      b.add('coneFloor', 'tintGlossy', { p: [x, h * 0.08, z], s: [r * 2, h * 0.92, r * 2], color: '#f97316' });
      b.add('cylinderFloor', 'tint', { p: [x, h * 0.45, z], s: [r * 1.25, h * 0.14, r * 1.25], color: '#ffffff' }, false);
  }
}

/** Boxes: pushable supply crates (dynamic) or static blocks. */
export function boxPiece(b: PropBatch, box: MapEntityOf<'box'>) {
  const { x, z } = box.position;
  const { x: sx, y: sy, z: sz } = box.size;
  if (box.dynamic) {
    b.add('boxFloor', 'tintGlossy', { p: [x, 0, z], r: box.rotation, s: [sx, sy, sz], color: '#f59e0b' });
    b.add('boxFloor', 'metalDark', { p: [x, -0.002, z], r: box.rotation, s: [sx * 1.03, sy * 1.02, sz * 0.22] });
    b.add('boxFloor', 'metalDark', { p: [x, -0.002, z], r: box.rotation, s: [sx * 0.22, sy * 1.02, sz * 1.03] });
    return;
  }
  if (prefixOf(String(box.id)) === 'crate') {
    crate(b, x, 0, z, Math.min(sx, sz), box.rotation);
    return;
  }
  b.add('boxFloor', 'metal', { p: [x, 0, z], r: box.rotation, s: [sx, sy * 0.8, sz] });
  b.add('boxFloor', 'hazard', { p: [x, sy * 0.8, z], r: box.rotation, s: [sx, sy * 0.2, sz] });
}

/** Bridge deck, beams and supports; steel bridges also get towers and cables. Rails come from the walls. */
/** `natural`: wooden decks use the textured plank material. */
export function bridgePieces(b: PropBatch, br: SceneBridge, drop: number, natural = false) {
  const dx = br.to.x - br.from.x;
  const dz = br.to.z - br.from.z;
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dz, dx);
  const ux = dx / len;
  const uz = dz / len;
  const nx = -uz;
  const nz = ux;
  const w = br.width;
  const mid = { x: (br.from.x + br.to.x) / 2, z: (br.from.z + br.to.z) / 2 };
  const rnd = seededRandom(Math.round(mid.x * 100 + mid.z * 7));

  if (br.style === 'log') {
    for (const k of [-0.2, 0.2]) b.add('cylinder', 'trunk', { p: [mid.x + nx * w * k, -0.055, mid.z + nz * w * k], r: [0, yaw, Math.PI / 2], s: [0.16, len + 0.2, 0.16] });
  }
  // Deck planks across the span.
  const planks = along(br.from, br.to, br.style === 'steel' ? 0.2 : 0.12);
  for (const p of planks) {
    if (natural && br.style !== 'steel') {
      const tone = 150 + Math.floor(rnd() * 50);
      b.add('box', 'planks', { p: [p.x, 0.0, p.z], r: yaw, s: [0.1, 0.022, w], color: `rgb(${tone},${tone},${tone})` });
      continue;
    }
    const mat = br.style === 'steel' ? 'metal' : rnd() < 0.3 ? 'woodDark' : 'wood';
    b.add('box', mat, { p: [p.x, 0.0, p.z], r: yaw, s: [br.style === 'steel' ? 0.19 : 0.1, 0.022, w] });
  }
  // Side beams.
  for (const k of [-0.5, 0.5]) {
    b.add('box', br.style === 'steel' ? 'metalDark' : 'woodDark', { p: [mid.x + nx * w * k, -0.035, mid.z + nz * w * k], r: yaw, s: [len + 0.1, 0.06, 0.05] });
  }
  if (br.style === 'steel') {
    b.add('box', 'tintMetal', { p: [mid.x, -0.09, mid.z], r: yaw, s: [len, 0.06, w * 0.9], color: '#b45309' });
    // Towers at both ends, cables sagging between, hangers down to the deck.
    const towerH = 1.25;
    const ends = [br.from, br.to].map((e, i) => ({ x: e.x - ux * (i === 0 ? 0.05 : -0.05), z: e.z - uz * (i === 0 ? 0.05 : -0.05) }));
    for (const e of ends) {
      for (const k of [-0.5, 0.5]) {
        const px = e.x + nx * (w * k + Math.sign(k) * 0.08);
        const pz = e.z + nz * (w * k + Math.sign(k) * 0.08);
        b.add('boxFloor', 'tintMetal', { p: [px, -drop, pz], r: yaw, s: [0.1, towerH + drop, 0.1], color: '#c2410c' });
        b.add('sphere', 'glowRed', { p: [px, towerH + 0.04, pz], s: 0.05 }, false);
      }
      b.add('box', 'tintMetal', { p: [e.x, towerH - 0.08, e.z], r: yaw, s: [0.08, 0.08, w + 0.26], color: '#c2410c' });
    }
    for (const k of [-0.5, 0.5]) {
      const off = w * k + Math.sign(k) * 0.08;
      const segs = 10;
      let prev: [number, number, number] | null = null;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const sag = 4 * t * (1 - t);
        const px = br.from.x + dx * t + nx * off;
        const pz = br.from.z + dz * t + nz * off;
        const py = towerH - 0.02 - sag * (towerH - 0.3);
        const cur: [number, number, number] = [px, py, pz];
        if (prev) pipe(b, prev, cur, 0.012, '#e5e7eb');
        if (i > 0 && i < segs) pipe(b, [px, 0.02, pz], [px, py, pz], 0.005, '#cbd5e1');
        prev = cur;
      }
    }
    // Piers into the gorge.
    for (const t of [0.33, 0.67]) {
      const px = br.from.x + dx * t;
      const pz = br.from.z + dz * t;
      b.add('boxFloor', 'concrete', { p: [px, -drop - 0.3, pz], r: yaw, s: [0.18, drop + 0.2, w * 0.7] });
    }
    return;
  }
  if (br.style === 'rope') {
    for (const e of [br.from, br.to]) for (const k of [-0.5, 0.5]) b.add('cylinderLow', 'trunk', { p: [e.x + nx * w * k, -0.1, e.z + nz * w * k], s: [0.06, 0.42, 0.06] });
    return;
  }
  // Wooden footbridge: short piers into the water.
  for (const t of [0.2, 0.8]) {
    for (const k of [-0.42, 0.42]) {
      const px = br.from.x + dx * t + nx * w * k;
      const pz = br.from.z + dz * t + nz * w * k;
      b.add('cylinderLow', 'woodDark', { p: [px, -drop - 0.1, pz], s: [0.05, drop + 0.08, 0.05] });
    }
  }
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
