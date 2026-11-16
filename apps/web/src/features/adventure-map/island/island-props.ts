import { seededRandom } from '../../simulator/environment/geometry';
import { PropBatch } from '../../simulator/environments/props/batch';
import { beaconMast, bush, building, chargingStation, container, crate, flowerPatch, gateFrame, jungleTree, lamp, pillar, pine, radarDish, rock, tree, tuft } from '../../simulator/environments/props/builders';
import type { AdventureLayout, AdventureView } from '../adventure.types';
import { arcLengths, indexAt, tangent } from '../geometry';
import { BOUNDS, WATER_Y } from '../layout';
import type { IslandLandmarks, Spot } from './island-landmarks';
import type { IslandGround } from './island-terrain';
import { ISLAND_THEMES, type IslandTheme } from './island-theme';

/*
 * The island's props as PropBatches (pure data → a few instanced draw calls):
 *   sceneryBatch — trees, rocks, set pieces, landmarks, bridge (static per world)
 *   skyBatch     — clouds and distant islets (no shadows)
 *   stateBatch   — mission beacons and the progress trail (rebuilt on progress)
 */

type Rnd = () => number;
const TAU = Math.PI * 2;

// ── custom set-piece builders ────────────────────────────────────────────

function windmill(b: PropBatch, x: number, y: number, z: number, yaw: number, rnd: Rnd) {
  b.add('cylinderLow', 'tint', { p: [x, y, z], s: [0.22, 2.9, 0.22], color: '#f1f5f9' });
  const top = y + 2.9;
  const f = { x: Math.sin(yaw) * 0.18, z: Math.cos(yaw) * 0.18 };
  b.add('box', 'tint', { p: [x, top, z], r: yaw, s: [0.2, 0.2, 0.42], color: '#e2e8f0' });
  const a0 = rnd() * TAU;
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k * TAU) / 3;
    b.add('box', 'tint', { p: [x + f.x + Math.sin(yaw + Math.PI / 2) * Math.cos(a) * 0.62, top + Math.sin(a) * 0.62, z + f.z + Math.cos(yaw + Math.PI / 2) * Math.cos(a) * 0.62], r: [0, yaw, a + Math.PI / 2], s: [1.25, 0.1, 0.03], color: '#ffffff' });
  }
  b.add('sphere', 'glowCyan', { p: [x + f.x, top, z + f.z], s: 0.1 }, false);
}

function solarPanels(b: PropBatch, x: number, y: number, z: number, yaw: number) {
  for (let k = -1; k <= 1; k++) {
    const px = x + Math.cos(yaw) * k * 0.62;
    const pz = z - Math.sin(yaw) * k * 0.62;
    b.add('boxFloor', 'metalDark', { p: [px, y, pz], s: [0.05, 0.28, 0.05] });
    b.add('box', 'tintMetal', { p: [px, y + 0.32, pz], r: [-0.55, yaw, 0], s: [0.56, 0.03, 0.4], color: '#1e40af' });
  }
}

function rover(b: PropBatch, x: number, y: number, z: number, yaw: number) {
  b.add('boxFloor', 'tint', { p: [x, y + 0.12, z], r: yaw, s: [0.55, 0.26, 0.38], color: '#f8fafc' });
  b.add('boxFloor', 'tint', { p: [x, y + 0.38, z], r: yaw, s: [0.3, 0.2, 0.28], color: '#e2e8f0' });
  b.add('box', 'glowCyan', { p: [x + Math.sin(yaw) * 0.145, y + 0.48, z + Math.cos(yaw) * 0.145], r: yaw, s: [0.2, 0.05, 0.01] }, false);
  for (const [a, c] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const px = x + Math.cos(yaw) * 0.2 * a + Math.sin(yaw) * 0.2 * c;
    const pz = z - Math.sin(yaw) * 0.2 * a + Math.cos(yaw) * 0.2 * c;
    b.add('cylinderLow', 'metalDark', { p: [px, y + 0.1, pz], r: [Math.PI / 2, yaw, 0], s: [0.2, 0.1, 0.2] });
  }
}

/** Low-poly cactus (map scale: a few dozen triangles). */
function cactus(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd) {
  const c = rnd() < 0.5 ? '#4f9a4a' : '#5fae52';
  b.add('cylinderLow', 'tintFlat', { p: [x, y, z], s: [0.14 * s, 0.62 * s, 0.14 * s], color: c });
  const side = rnd() < 0.5 ? 1 : -1;
  b.add('cylinderLow', 'tintFlat', { p: [x + 0.12 * side * s, y + 0.26 * s, z], s: [0.09 * s, 0.26 * s, 0.09 * s], color: c });
}

function spire(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, color: string) {
  b.add('coneLow', 'tintFlat', { p: [x, y - 0.1, z], r: rnd() * TAU, s: [0.9 * s, 2.6 * s, 0.9 * s], color });
  b.add('coneLow', 'tintFlat', { p: [x + 0.5 * s, y - 0.1, z + 0.2 * s], r: rnd() * TAU, s: [0.55 * s, 1.5 * s, 0.55 * s], color });
}

function crystal(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd, glow: 'glowCyan' | 'glowPurple' | 'glowAmber' | 'lava') {
  b.add('octa', glow, { p: [x, y + 0.35 * s, z], r: [0.2, rnd() * TAU, 0.1], s: [0.28 * s, 0.8 * s, 0.28 * s] }, false);
  b.add('octa', glow, { p: [x + 0.22 * s, y + 0.2 * s, z + 0.1 * s], r: [-0.4, rnd() * TAU, 0.3], s: [0.16 * s, 0.45 * s, 0.16 * s] }, false);
}

function vegetation(b: PropBatch, t: IslandTheme, x: number, y: number, z: number, s: number, rnd: Rnd) {
  switch (t.tree) {
    case 'round':
      return rnd() < 0.3 ? pine(b, x, y, z, s * 1.5, rnd) : tree(b, x, y, z, s * 1.2, rnd, t.leaves);
    case 'pine':
      return pine(b, x, y, z, s * 1.6, rnd);
    case 'snowPine':
      return pine(b, x, y, z, s * 1.7, rnd, true);
    case 'jungle':
      return rnd() < 0.6 ? jungleTree(b, x, y, z, s * 1.1, rnd) : tree(b, x, y, z, s * 1.3, rnd, t.leaves);
    case 'cactus':
      return rnd() < 0.5 ? cactus(b, x, y, z, s * 1.6, rnd) : rock(b, x, y, z, s * 0.6, rnd, t.rock);
    case 'crystal':
      return rnd() < 0.5 ? tree(b, x, y, z, s, rnd, t.leaves) : rock(b, x, y, z, s * 0.5, rnd, t.rock);
  }
}

// ── landmarks ────────────────────────────────────────────────────────────

function launchPad(b: PropBatch, s: Spot, rnd: Rnd) {
  b.add('hexFloor', 'concrete', { p: [s.x, s.y - 0.6, s.z], r: s.yaw, s: [3.4, 0.66, 3.4] });
  b.add('hexFloor', 'metal', { p: [s.x, s.y + 0.02, s.z], r: s.yaw, s: [2.6, 0.06, 2.6] });
  b.add('ring', 'glowCyan', { p: [s.x, s.y + 0.1, s.z], s: [2.2, 1, 2.2] }, false);
  // Garage + containers + a rover at the edge of the pad.
  const side = { x: Math.cos(s.yaw), z: -Math.sin(s.yaw) };
  building(b, s.x + side.x * 1.2 - Math.sin(s.yaw) * 1.2, s.y, s.z + side.z * 1.2 - Math.cos(s.yaw) * 1.2, 1.1, 0.8, 0.9, s.yaw, '#e2e8f0', 'glowCyan');
  container(b, s.x - side.x * 1.3, s.y, s.z - side.z * 1.3, s.yaw, '#f97316', 1.4);
  crate(b, s.x - side.x * 0.9 + 0.4, s.y, s.z - side.z * 0.9 - 0.5, 0.3, rnd(), '#d9a066');
  rover(b, s.x + side.x * 0.2, s.y + 0.08, s.z + side.z * 0.2, s.yaw + 0.4);
  lamp(b, s.x + side.x * 1.6, s.y, s.z + side.z * 1.6, s.yaw, 1.1);
  lamp(b, s.x - side.x * 1.6, s.y, s.z - side.z * 1.6, s.yaw, 1.1);
}

function station(b: PropBatch, s: Spot, rnd: Rnd) {
  b.add('hexFloor', 'concrete', { p: [s.x, s.y - 0.4, s.z], r: s.yaw, s: [2.6, 0.5, 2.6] });
  building(b, s.x, s.y + 0.08, s.z, 1.3, 1.0, 1.0, s.yaw, '#eef2f8', 'glowCyan');
  radarDish(b, s.x + 0.8, s.y + 0.08, s.z - 0.6, s.yaw, 1.3);
  chargingStation(b, s.x - 0.8, s.y + 0.08, s.z + 0.5, s.yaw, 1.3);
  crate(b, s.x - 0.9, s.y + 0.08, s.z - 0.7, 0.3, rnd(), '#c98a4b');
}

function gateTowers(b: PropBatch, g: { x: number; y: number; z: number; yaw: number; width: number }) {
  gateFrame(b, g.x, g.y, g.z, g.yaw, g.width, 1.7, 'glowCyan');
  for (const k of [-1, 1]) {
    const tx = g.x + Math.sin(g.yaw) * (g.width / 2 + 0.55) * k;
    const tz = g.z + Math.cos(g.yaw) * (g.width / 2 + 0.55) * k;
    b.add('boxFloor', 'tint', { p: [tx, g.y - 0.3, tz], r: g.yaw, s: [0.8, 2.6, 0.8], color: '#cbd5e1' });
    b.add('boxFloor', 'metalDark', { p: [tx, g.y + 2.3, tz], r: g.yaw, s: [0.95, 0.18, 0.95] });
    b.add('box', 'glowCyan', { p: [tx, g.y + 1.2, tz], r: g.yaw, s: [0.82, 0.9, 0.12] }, false);
    b.add('coneLow', 'metal', { p: [tx, g.y + 2.48, tz], r: g.yaw, s: [0.5, 0.45, 0.5] });
  }
}

function arenaBase(b: PropBatch, s: Spot) {
  b.add('cylinderFloor', 'concrete', { p: [s.x, s.y - 1.2, s.z], s: [5.2, 1.25, 5.2] });
  b.add('cylinderFloor', 'metal', { p: [s.x, s.y - 0.02, s.z], s: [4.4, 0.08, 4.4] });
  b.add('ring', 'glowPurple', { p: [s.x, s.y + 0.08, s.z], s: [4.1, 1, 4.1] }, false);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    const px = s.x + Math.cos(a) * 2.3;
    const pz = s.z + Math.sin(a) * 2.3;
    b.add('boxFloor', 'tint', { p: [px, s.y, pz], r: -a, s: [0.26, 1.1, 0.26], color: '#e2e8f0' });
    b.add('sphere', 'glowPurple', { p: [px, s.y + 1.2, pz], s: 0.2 }, false);
  }
}

function bridge(b: PropBatch, layout: AdventureLayout, t: IslandTheme) {
  const c = layout.crossing;
  if (!c) return;
  const lengths = arcLengths(layout.route);
  const near = layout.route.reduce((best, p, i) => ((p.x - c.bridge.x) ** 2 + (p.y - c.bridge.y) ** 2 < best.d ? { i, d: (p.x - c.bridge.x) ** 2 + (p.y - c.bridge.y) ** 2 } : best), { i: 0, d: Infinity }).i;
  const s0 = lengths[near]!;
  const deck = t.bridge === 'energy' ? 'glowCyan' : t.bridge === 'steel' ? 'metal' : 'wood';
  for (let s = s0 - 2.1; s <= s0 + 2.1; s += 0.22) {
    const i = indexAt(lengths, s);
    const p = layout.route[i]!;
    const tg = tangent(layout.route, i);
    const yaw = -Math.atan2(tg.y, tg.x);
    const y = layout.routeY[i]!;
    b.add('box', deck, { p: [p.x, y + 0.02, p.y], r: yaw, s: [0.16, 0.07, 1.35] });
    for (const k of [-1, 1]) {
      const rx = p.x - tg.y * 0.68 * k;
      const rz = p.y + tg.x * 0.68 * k;
      b.add('box', t.bridge === 'wood' ? 'woodDark' : 'metalDark', { p: [rx, y + 0.35, rz], r: yaw, s: [0.24, 0.05, 0.05] });
      if (Math.round((s - s0) / 0.22) % 3 === 0) b.add('boxFloor', t.bridge === 'wood' ? 'woodDark' : 'metalDark', { p: [rx, y, rz], r: yaw, s: [0.06, 0.4, 0.06] });
    }
  }
  // Piers down into the gorge.
  for (const ds of [-1.5, 1.5]) {
    const i = indexAt(lengths, s0 + ds);
    const p = layout.route[i]!;
    const y = layout.routeY[i]!;
    b.add('cylinderLow', t.bridge === 'wood' ? 'woodDark' : 'metal', { p: [p.x, WATER_Y - 0.4, p.y], s: [0.3, y - WATER_Y + 0.35, 0.3] });
  }
}

function setPiece(b: PropBatch, t: IslandTheme, s: { x: number; y: number; z: number; yaw: number; flavor: string }, rnd: Rnd) {
  switch (s.flavor) {
    case 'tech':
    case 'base':
      building(b, s.x, s.y, s.z, 1.5, 1.2, 1.1, s.yaw, '#eef2f8', 'glowCyan');
      solarPanels(b, s.x + Math.cos(s.yaw) * 1.6, s.y, s.z - Math.sin(s.yaw) * 1.6, s.yaw);
      beaconMast(b, s.x - Math.cos(s.yaw) * 1.2, s.y, s.z + Math.sin(s.yaw) * 1.2, 2.2, 'glowCyan');
      radarDish(b, s.x - 0.6, s.y, s.z + 1.1, s.yaw, 1.2);
      for (let k = 0; k < 3; k++) crate(b, s.x + 0.9 + rnd() * 0.5, s.y, s.z + 0.8 + rnd() * 0.4, 0.28, rnd(), '#d9a066');
      return;
    case 'meadow':
      windmill(b, s.x, s.y, s.z, s.yaw, rnd);
      for (let k = 0; k < 4; k++) flowerPatch(b, s.x + (rnd() - 0.5) * 2.4, s.y, s.z + (rnd() - 0.5) * 2.4, rnd);
      return;
    case 'rocky':
      spire(b, s.x, s.y, s.z, 1, rnd, t.rock);
      spire(b, s.x + 1.2, s.y, s.z - 0.8, 0.7, rnd, t.cliff);
      return;
    case 'river':
      rover(b, s.x, s.y, s.z, s.yaw);
      for (let k = 0; k < 3; k++) rock(b, s.x + (rnd() - 0.5) * 2, s.y, s.z + (rnd() - 0.5) * 2, 0.5, rnd, t.rock);
      return;
    case 'forest':
      pillar(b, s.x, s.y, s.z, 0.9, rnd);
      pillar(b, s.x + 0.6, s.y, s.z + 0.3, 0.6, rnd);
      return;
    default:
      return;
  }
}

// ── batches ──────────────────────────────────────────────────────────────

const FOREST_DENSITY: Readonly<Record<string, number>> = { forest: 0.95, meadow: 0.3, rocky: 0.28, river: 0.35, tech: 0.22, base: 0.14, arena: 0.08 };

/** Static scenery: vegetation, rocks, set pieces and landmark structures. */
export function sceneryBatch(layout: AdventureLayout, ground: IslandGround, marks: IslandLandmarks): PropBatch {
  const t = ISLAND_THEMES[layout.theme];
  const b = new PropBatch();
  const rnd = seededRandom(layout.seed * 13 + 7);
  const cell = 0.68;
  for (let z = BOUNDS.minZ - 3; z < BOUNDS.maxZ + 3; z += cell) {
    for (let x = BOUNDS.minX - 3; x < BOUNDS.maxX + 3; x += cell) {
      const px = x + (rnd() - 0.5) * cell;
      const pz = z + (rnd() - 0.5) * cell;
      const { i, d } = ground.nearest(px, pz);
      if (d < 1.35) continue;
      const flavor = layout.regions[layout.routeRegion[i]!]?.flavor ?? 'meadow';
      const clump = Math.sin(px * 0.5 + layout.seed) * Math.cos(pz * 0.45) > 0.1 ? 1 : 0.45;
      if (rnd() > (FOREST_DENSITY[flavor] ?? 0.3) * clump * 0.8) continue;
      const y = ground.height(px, pz);
      if (y < WATER_Y + 0.25) continue;
      const slope = Math.abs(ground.height(px + 0.3, pz) - y) + Math.abs(ground.height(px, pz + 0.3) - y);
      if (slope > 0.35) continue;
      if (ground.riverDist(px, pz) < 1.8) continue;
      if (marks.keepClear.some((k) => (k.p.x - px) ** 2 + (k.p.y - pz) ** 2 < k.r * k.r)) continue;
      const s = 0.9 + rnd() * 0.6;
      const roll = rnd();
      if (flavor === 'rocky' && roll < 0.45) rock(b, px, y, pz, s * 0.7, rnd, t.rock);
      else if (flavor === 'arena' && roll < 0.5) crystal(b, px, y, pz, s, rnd, layout.theme === 'lava' ? 'lava' : 'glowCyan');
      else if ((flavor === 'meadow' || flavor === 'base') && roll < 0.35) (roll < 0.15 ? flowerPatch(b, px, y, pz, rnd) : bush(b, px, y, pz, s * 1.4, rnd, t.leaves));
      else if (roll < 0.08) tuft(b, px, y, pz, s * 1.5, rnd);
      else vegetation(b, t, px, y, pz, s, rnd);
    }
  }

  // Road-side dressing: bushes, rocks and fence posts line the way (never on a stop).
  const lengths = arcLengths(layout.route);
  const stopArcs = layout.routeIndex.map((i) => lengths[i]!);
  for (let s = 1.5; s < lengths[lengths.length - 1]!; s += 0.9 + rnd() * 0.8) {
    if (stopArcs.some((a) => Math.abs(a - s) < 1.1)) continue;
    const i = indexAt(lengths, s);
    const p = layout.route[i]!;
    const tg = tangent(layout.route, i);
    const side = rnd() < 0.5 ? 1 : -1;
    const off = 0.95 + rnd() * 0.35;
    const x = p.x - tg.y * off * side;
    const z = p.y + tg.x * off * side;
    if (ground.riverDist(x, z) < 1.6 || marks.keepClear.some((k) => (k.p.x - x) ** 2 + (k.p.y - z) ** 2 < (k.r * 0.8) ** 2)) continue;
    const y = layout.routeY[i]!;
    const roll = rnd();
    if (roll < 0.45) bush(b, x, y, z, 1.1 + rnd() * 0.5, rnd, t.leaves);
    else if (roll < 0.75) rock(b, x, y, z, 0.28 + rnd() * 0.2, rnd, t.rock);
    else if (roll < 0.9) flowerPatch(b, x, y, z, rnd);
    else b.add('cylinderLow', 'wood', { p: [x, y, z], s: [0.07, 0.34, 0.07] });
  }

  launchPad(b, marks.startPad, rnd);
  for (const s of marks.stations.values()) station(b, s, rnd);
  for (const g of marks.gates) gateTowers(b, g);
  if (marks.arena) arenaBase(b, marks.arena);
  bridge(b, layout, t);
  for (const s of marks.setPieces) setPiece(b, t, s, rnd);
  // Challenge outposts: a small platform at each side mission.
  for (const c of layout.challenges) {
    const y = ground.height(c.pos.x, c.pos.y);
    b.add('hexFloor', 'concrete', { p: [c.pos.x, Math.min(y, c.h) - 0.4, c.pos.y], s: [1.5, c.h - Math.min(y, c.h) + 0.45, 1.5] });
    beaconMast(b, c.pos.x + 0.55, c.h, c.pos.y - 0.35, 1.2, 'glowAmber');
  }
  return b;
}

/** Clouds around the island and distant islets on the horizon (no shadows). */
export function skyBatch(layout: AdventureLayout): PropBatch {
  const t = ISLAND_THEMES[layout.theme];
  const b = new PropBatch();
  const rnd = seededRandom(layout.seed * 17 + 3);
  const cloud = (x: number, y: number, z: number, s: number) => {
    for (let k = 0; k < 5; k++) b.add('puff', 'tintFlat', { p: [x + (rnd() - 0.5) * 2.4 * s, y + rnd() * 0.5 * s, z + (rnd() - 0.5) * 1.2 * s], s: [(1.1 + rnd()) * s, (0.7 + rnd() * 0.4) * s, (0.9 + rnd() * 0.5) * s], color: t.cloud }, false);
  };
  // A ring of clouds around the island, thicker at the corners.
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * TAU + rnd() * 0.2;
    const r = 27 + rnd() * 9;
    cloud(Math.cos(a) * r * 1.1, 1.5 + rnd() * 3, Math.sin(a) * r * 0.9, 1.4 + rnd() * 1.2);
  }
  // Distant islets.
  for (let k = 0; k < 12; k++) {
    const a = rnd() * TAU;
    const r = 30 + rnd() * 16;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.85;
    const s = 1 + rnd() * 1.6;
    b.add('icosa', 'tintFlat', { p: [x, WATER_Y - 0.6 * s, z], r: rnd() * TAU, s: [2.2 * s, 1.6 * s, 2 * s], color: t.cliff }, false);
    b.add('icosa', 'tintFlat', { p: [x, WATER_Y + 0.45 * s, z], r: rnd() * TAU, s: [2 * s, 0.5 * s, 1.8 * s], color: t.ground.forest }, false);
    for (let j = 0; j < 3; j++) vegetation(b, t, x + (rnd() - 0.5) * s, WATER_Y + 0.6 * s, z + (rnd() - 0.5) * s, 0.9, rnd);
  }
  return b;
}

/** Mission beacons, status lights and the progress trail (rebuilt when progress changes). */
export function stateBatch(layout: AdventureLayout, view: AdventureView, marks: IslandLandmarks): PropBatch {
  const b = new PropBatch();
  const heightOf = new Map([...layout.main, ...layout.challenges].map((s) => [s.def.id, s.h]));
  for (const s of view.stops) {
    const h = heightOf.get(s.id) ?? 0;
    const { x, y: z } = s.pos;
    const lit = s.status === 'completed' ? 'glowGreen' : s.status === 'locked' ? null : 'glowCyan';
    if (s.kind === 'mission') {
      b.add('cylinderFloor', 'metalDark', { p: [x, h - 0.05, z], s: [0.62, 0.14, 0.62] });
      b.add('cylinderFloor', lit ?? 'metal', { p: [x, h + 0.08, z], s: [0.44, 0.03, 0.44] }, false);
      if (lit) b.add('octa', lit, { p: [x, h + 0.42, z], s: [0.13, 0.26, 0.13] }, false);
    } else if (s.kind === 'challenge') {
      b.add('octa', s.status === 'locked' ? 'metalDark' : 'glowAmber', { p: [x, h + 0.5, z], r: [0, 0.4, 0], s: [0.3, 0.46, 0.3] }, false);
    } else if (s.kind === 'checkpoint') {
      const st = marks.stations.get(s.id);
      if (st) b.add('sphere', s.status === 'completed' ? 'glowGreen' : 'glowAmber', { p: [st.x, st.y + 1.5, st.z], s: 0.24 }, false);
    }
  }
  // Trail: small dashes on the road — bright where done, soft white up to the next mission.
  const lengths = arcLengths(layout.route);
  for (const seg of view.segments) {
    if (seg.state === 'locked') continue;
    for (let s = lengths[seg.from]! + 0.35; s < lengths[seg.to]! - 0.35; s += 0.55) {
      const i = indexAt(lengths, s);
      const p = layout.route[i]!;
      const tg = tangent(layout.route, i);
      b.add('box', seg.state === 'done' ? 'glowCyan' : 'glowWarm', { p: [p.x, layout.routeY[i]! + 0.07, p.y], r: -Math.atan2(tg.y, tg.x), s: [0.24, 0.025, 0.08] }, false);
    }
  }
  return b;
}
