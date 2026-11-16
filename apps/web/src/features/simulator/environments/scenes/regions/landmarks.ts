import type { Vec2 } from '@robolab/shared';
import type { LevelDefinition } from '../../../../../content/levels/types';
import type { PropBatch } from '../../props/batch';
import { barrel, beaconMast, bench, building, bush, chargingStation, container, crate, flowerPatch, gateFrame, lamp, LEAF, radarDish, rock, sign, tank, warningSign } from '../../props/builders';
import type { RegionId } from './regions';

type Rnd = () => number;

/** What a landmark builder gets: the level, where the goal is and which way the robot arrives. */
export interface LandmarkContext {
  readonly level: LevelDefinition;
  readonly rnd: Rnd;
  /** Goal centre. */
  readonly goal: Vec2;
  /** Unit direction the robot arrives in (last road segment). */
  readonly dir: Vec2;
  /** Yaw for a building whose front faces the arriving robot. */
  readonly facing: number;
  /** A point `d` metres beyond the goal, `s` metres to its side (+ = left of arrival). */
  readonly beyond: (d: number, s?: number) => Vec2;
  /** Ground height (props sit on hills). */
  readonly y: (x: number, z: number) => number;
  /** Is (x, z) clear of the road, water, start and goal (with `margin`)? */
  readonly clear: (x: number, z: number, margin?: number) => boolean;
}

/** The first of the eight spots `r` metres around (x, z) that is clear of the course. */
function besideCourse(c: LandmarkContext, x: number, z: number, r = 0.55): Vec2 | null {
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 4;
    const p = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
    if (c.clear(p.x, p.z, 0.12)) return p;
  }
  return null;
}

export interface Landmark {
  readonly region: RegionId;
  readonly build: (b: PropBatch, c: LandmarkContext) => void;
}

const WHITE = '#f8fafc';

/** A small boat hull at (x, z) along `yaw`. */
function boat(b: PropBatch, x: number, z: number, yaw: number, color = '#dc2626') {
  b.add('boxFloor', 'tint', { p: [x, -0.24, z], r: yaw, s: [0.62, 0.16, 0.24], color });
  b.add('boxFloor', 'wood', { p: [x, -0.1, z], r: yaw, s: [0.5, 0.03, 0.2] });
  b.add('boxFloor', 'tint', { p: [x - Math.cos(yaw) * 0.1, -0.08, z + Math.sin(yaw) * 0.1], r: yaw, s: [0.16, 0.14, 0.16], color: WHITE });
}

/** Wooden jetty planks from a to c. */
function jetty(b: PropBatch, a: Vec2, c: Vec2, width = 0.36) {
  const len = Math.hypot(c.x - a.x, c.z - a.z);
  const yaw = Math.atan2(-(c.z - a.z), c.x - a.x);
  b.add('box', 'wood', { p: [(a.x + c.x) / 2, -0.02, (a.z + c.z) / 2], r: yaw, s: [len, 0.04, width] });
  const n = Math.max(2, Math.round(len / 0.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    for (const k of [-1, 1]) {
      const px = a.x + (c.x - a.x) * t - Math.sin(yaw) * k * width * 0.45;
      const pz = a.z + (c.z - a.z) * t - Math.cos(yaw) * k * width * 0.45;
      b.add('cylinderLow', 'woodDark', { p: [px, -0.35, pz], s: [0.05, 0.42, 0.05] });
    }
  }
}

/** Striped tower with a light on top (lighthouse / lookout). */
function tower(b: PropBatch, x: number, y: number, z: number, h: number, stripe: string, glow: 'glowWarm' | 'glowAmber' | 'glowCyan' = 'glowWarm') {
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    const r = 0.22 - i * 0.025;
    b.add('cylinderFloor', 'tint', { p: [x, y + (h * i) / bands, z], s: [r * 2, h / bands, r * 2], color: i % 2 ? stripe : WHITE });
  }
  b.add('cylinderFloor', glow, { p: [x, y + h, z], s: [0.2, 0.14, 0.2] }, false);
  b.add('coneFloor', 'metalDark', { p: [x, y + h + 0.14, z], s: [0.3, 0.16, 0.3] });
}

/** Canvas tent. */
function tent(b: PropBatch, x: number, z: number, yaw: number, color: string) {
  b.add('coneLow', 'tintFlat', { p: [x, 0, z], r: yaw, s: [0.5, 0.42, 0.5], color });
  b.add('box', 'metalDark', { p: [x + Math.sin(yaw) * 0.2, 0.1, z + Math.cos(yaw) * 0.2], r: yaw, s: [0.14, 0.2, 0.02] });
}

/** Camp fire: stones + glowing embers. */
function campfire(b: PropBatch, x: number, z: number, rnd: Rnd) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    rock(b, x + Math.cos(a) * 0.1, 0, z + Math.sin(a) * 0.1, 0.05, rnd, '#8d9488');
  }
  b.add('icosa', 'glowAmber', { p: [x, 0.04, z], s: [0.1, 0.08, 0.1] }, false);
}

/** Water wheel standing on its edge. */
function millWheel(b: PropBatch, x: number, z: number, yaw: number) {
  b.add('cylinder', 'woodDark', { p: [x, 0.3, z], r: [Math.PI / 2, yaw, 0], s: [0.6, 0.1, 0.6] });
  b.add('cylinder', 'metalDark', { p: [x, 0.3, z], r: [Math.PI / 2, yaw, 0], s: [0.12, 0.16, 0.12] });
}

/**
 * One landmark per Starter Island mission (4–24), keyed by environment id —
 * the thing the student drives toward and remembers the place by.
 */
export const LANDMARKS = {
  'starter-meadow-lanes': {
    region: 'meadow',
    build: (b, c) => {
      const p = c.beyond(1.0);
      building(b, p.x, 0, p.z, 0.9, 0.55, 0.7, c.facing, '#fde7c4', 'glowWarm');
      b.add('coneLow', 'tintFlat', { p: [p.x, 0.58, p.z], r: c.facing, s: [1.1, 0.35, 1.0], color: '#b45309' });
      for (let i = 0; i < 8; i++) flowerPatch(b, p.x + (c.rnd() - 0.5) * 1.6, 0, p.z + (c.rnd() - 0.5) * 1.6, c.rnd);
      sign(b, c.level.map.start.x - 0.2, 0, c.level.map.start.z - 0.6, 0, '#16a34a');
    },
  },
  'starter-beacon-field': {
    region: 'meadow',
    build: (b, c) => {
      const p = c.beyond(0.9);
      beaconMast(b, p.x, 0, p.z, 1.6, 'glowAmber');
      b.add('hexFloor', 'concrete', { p: [p.x, 0, p.z], s: [0.5, 0.08, 0.5] });
      // A small beacon post next to every checkpoint.
      for (const e of c.level.map.entities) {
        if (e.type !== 'checkpoint' || e.area.shape !== 'circle') continue;
        const q = e.area.center;
        const spot = besideCourse(c, q.x, q.z, 0.6);
        if (spot) beaconMast(b, spot.x, 0, spot.z, 0.45, 'glowCyan');
      }
    },
  },
  'starter-boulder-woods': {
    region: 'forest',
    build: (b, c) => {
      const p = c.beyond(0.75);
      gateFrame(b, p.x, 0, p.z, c.facing + Math.PI / 2, 1.0, 0.7, 'glowAmber');
      for (let i = 0; i < 4; i++) b.add('cylinder', 'trunk', { p: [p.x + c.dir.z * 0.9, 0.06 + i * 0.1, p.z - c.dir.x * 0.9], r: [Math.PI / 2, c.facing, 0], s: [0.1, 0.6, 0.1] });
      for (let i = 0; i < 5; i++) rock(b, -1.4 + c.rnd() * 1.6, 0, 1.2 + c.rnd() * 0.3, 0.12 + c.rnd() * 0.1, c.rnd, '#8d9488');
    },
  },
  'starter-log-bridge': {
    region: 'forest',
    build: (b, c) => {
      const p = c.beyond(0.9);
      tent(b, p.x, p.z + 0.35, c.facing, '#f59e0b');
      tent(b, p.x + 0.2, p.z - 0.45, c.facing, '#16a34a');
      campfire(b, p.x - 0.35, p.z, c.rnd);
      bench(b, p.x - 0.35, 0, p.z + 0.3, 0);
    },
  },
  'starter-ranger-hut': {
    region: 'forest',
    build: (b, c) => {
      // The hut stands just outside the spiral (the goal is at its heart), facing in.
      const p = { x: c.level.map.size.x / 2 - 0.15, z: c.goal.z };
      if (c.clear(p.x, p.z, 0.4)) {
        building(b, p.x, 0, p.z, 0.75, 0.45, 0.6, -Math.PI / 2, '#a16207', 'glowWarm');
        b.add('coneLow', 'tintFlat', { p: [p.x, 0.47, p.z], r: -Math.PI / 2, s: [0.95, 0.3, 0.8], color: '#14532d' });
        barrel(b, p.x, 0, p.z + 0.55, 0.9, '#78350f');
      }
      const lampAt = besideCourse(c, c.goal.x, c.goal.z, 0.75);
      if (lampAt) lamp(b, lampAt.x, 0, lampAt.z, Math.PI);
    },
  },
  'starter-ferry-landing': {
    region: 'river',
    build: (b, c) => {
      const p = c.beyond(0.85);
      building(b, p.x, 0, p.z, 0.8, 0.5, 1.0, c.facing, '#e0f2fe', 'glowWarm');
      for (const w of c.level.scene.water ?? []) {
        // Moored at the river's far end, away from the bridge.
        const m = w.points[0];
        if (m) boat(b, m.x, m.z + 0.4, Math.PI / 2, '#0ea5e9');
      }
      sign(b, c.goal.x - 0.3, 0, c.goal.z + 0.6, 0, '#0284c7');
    },
  },
  'starter-river-docks': {
    region: 'river',
    build: (b, c) => {
      const p = c.beyond(0.85);
      building(b, p.x, 0, p.z, 0.9, 0.55, 0.8, c.facing, '#fef3c7', 'glowAmber');
      jetty(b, { x: -1.6, z: -1.8 }, { x: -1.6, z: -2.7 });
      jetty(b, { x: 1.0, z: -1.8 }, { x: 1.0, z: -2.8 });
      boat(b, -1.2, -2.35, Math.PI / 2, '#f97316');
      boat(b, 1.45, -2.4, Math.PI / 2);
    },
  },
  'starter-stepping-stones': {
    region: 'river',
    build: (b, c) => {
      const p = c.beyond(1.05);
      building(b, p.x, 0, p.z, 0.8, 0.6, 0.7, c.facing, '#e7e5e4', 'glowWarm');
      millWheel(b, p.x + c.dir.z * 0.5, p.z - c.dir.x * 0.5, c.facing);
      // Stepping stones straight across the river.
      const w = c.level.scene.water?.[0];
      const q = w?.points[1];
      if (w && q) for (let i = 0; i < 6; i++) rock(b, q.x - 1.2, -0.12, q.z - w.width / 2 - 0.05 + i * ((w.width + 0.1) / 5), 0.08, c.rnd, '#cbd5e1');
    },
  },
  'starter-harbour-spiral': {
    region: 'river',
    build: (b, c) => {
      // The lighthouse stands on the harbour wall, in view from the start.
      tower(b, 2.25, 0, 1.95, 1.3, '#dc2626');
      jetty(b, { x: -2.2, z: 2.0 }, { x: -2.2, z: 2.9 });
      boat(b, -1.8, 2.45, Math.PI / 2, '#2563eb');
      for (let i = 0; i < 5; i++) b.add('cylinderLow', 'woodDark', { p: [-1.2 + i * 0.7, -0.1, 1.95], s: [0.06, 0.28, 0.06] });
    },
  },
  'starter-boat-dock': {
    region: 'river',
    build: (b, c) => {
      jetty(b, { x: c.goal.x, z: c.goal.z + 0.5 }, { x: c.goal.x, z: c.goal.z + 1.6 }, 0.5);
      boat(b, c.goal.x - 0.5, 1.2, Math.PI / 2, '#16a34a');
      boat(b, c.goal.x + 0.5, 1.25, Math.PI / 2, '#f59e0b');
      for (const s of [-1, 1]) b.add('cylinderLow', 'tintFlat', { p: [c.goal.x + s * 0.34, 0, c.goal.z + 0.3], s: [0.07, 0.3, 0.07], color: '#facc15' });
      building(b, -1.4, 0, 0.7, 0.8, 0.45, 0.5, Math.PI, '#e0f2fe', 'glowCyan');
    },
  },
  'starter-sensor-lab': {
    region: 'facility',
    build: (b, c) => {
      const p = c.beyond(0.95);
      building(b, p.x, 0, p.z, 1.2, 0.7, 0.8, c.facing, '#eef2f8', 'glowCyan');
      radarDish(b, p.x + c.dir.z * 0.9, 0, p.z - c.dir.x * 0.9, c.facing, 0.9);
      for (const e of c.level.map.entities) {
        if (e.type !== 'line') continue;
        const q = besideCourse(c, e.points[0]!.x, (e.points[0]!.z + e.points[1]!.z) / 2, 0.7);
        if (q) warningSign(b, q.x, 0, q.z, 0);
      }
    },
  },
  'starter-facility-yard': {
    region: 'facility',
    build: (b, c) => {
      const p = c.beyond(0.9);
      container(b, p.x, 0, p.z + 0.4, c.facing + Math.PI / 2, '#2563eb');
      container(b, p.x, 0, p.z - 0.4, c.facing + Math.PI / 2, '#d9573b');
      container(b, p.x, 0.5, p.z, c.facing + Math.PI / 2, '#16a34a');
      for (const e of c.level.map.entities) {
        if (e.type !== 'checkpoint' || e.area.shape !== 'circle') continue;
        gateFrame(b, e.area.center.x, 0, e.area.center.z, 0, 0.9, 0.55, 'glowCyan');
      }
    },
  },
  'starter-signal-crossing': {
    region: 'facility',
    build: (b, c) => {
      const p = c.beyond(0.8);
      tower(b, p.x, 0, p.z, 1.1, '#2563eb', 'glowCyan');
      for (const e of c.level.map.entities) {
        if (e.type !== 'colorZone' || e.area.shape !== 'rect') continue;
        const q = besideCourse(c, e.area.center.x, e.area.center.z, 0.6);
        if (!q) continue;
        b.add('cylinderLow', 'metalDark', { p: [q.x, 0, q.z], s: [0.03, 0.5, 0.03] });
        b.add('sphere', e.color === 'red' ? 'glowRed' : 'glowCyan', { p: [q.x, 0.52, q.z], s: 0.06 }, false);
      }
    },
  },
  'starter-rescue-depot': {
    region: 'facility',
    build: (b, c) => {
      b.add('hexFloor', 'concrete', { p: [c.goal.x - 0.9, 0, c.goal.z], s: [0.7, 0.03, 0.7] });
      b.add('ring', 'glowAmber', { p: [c.goal.x - 0.9, 0.035, c.goal.z], s: 0.55 }, false);
      tank(b, 0.1, 0.5, -0.1, 0.12, 0.2, '#f97316');
      // The stranded drone, just past the fence at the far corner.
      b.add('sphere', 'tintFlat', { p: [1.7, 0.08, 0.0], s: [0.16, 0.06, 0.16], color: '#e2e8f0' });
      lamp(b, 1.6, 0, 1.6, Math.PI);
    },
  },
  'starter-energy-spiral': {
    region: 'canyon',
    build: (b, c) => {
      const p = c.beyond(0.55);
      chargingStation(b, p.x, 0, p.z, c.facing + Math.PI / 2, 1.6);
      beaconMast(b, p.x + c.dir.z * 0.7, 0, p.z - c.dir.x * 0.7, 1.2, 'glowCyan');
      // Old mine mouth in the cliff beside the spiral's long west side.
      b.add('box', 'woodDark', { p: [-2.1, 0.3, -0.4], s: [0.08, 0.06, 0.5] });
      for (const s of [-1, 1]) b.add('boxFloor', 'woodDark', { p: [-2.1, 0, -0.4 + s * 0.22], s: [0.06, 0.3, 0.06] });
    },
  },
  'starter-canyon-switchbacks': {
    region: 'canyon',
    build: (b, c) => {
      // The lookout stands just outside the maze, beside the exit cell.
      const p = { x: c.goal.x + 0.95, z: c.goal.z };
      b.add('boxFloor', 'woodDark', { p: [p.x, 0, p.z], s: [0.5, 0.7, 0.5] });
      b.add('boxFloor', 'wood', { p: [p.x, 0.7, p.z], s: [0.7, 0.05, 0.7] });
      b.add('coneLow', 'tintFlat', { p: [p.x, 0.95, p.z], s: [0.8, 0.3, 0.8], color: '#9a3412' });
      for (const s of [-1, 1]) for (const t of [-1, 1]) b.add('cylinderLow', 'woodDark', { p: [p.x + s * 0.3, 0.7, p.z + t * 0.3], s: [0.03, 0.25, 0.03] });
    },
  },
  'starter-gorge-run': {
    region: 'canyon',
    build: (b, c) => {
      const p = c.beyond(0.36);
      gateFrame(b, p.x, 0, p.z, c.facing + Math.PI / 2, 1.1, 0.8, 'glowAmber');
      const signAt = besideCourse(c, c.goal.x, c.goal.z, 0.7);
      if (signAt) warningSign(b, signAt.x, 0, signAt.z, 0);
    },
  },
  'starter-supply-outpost': {
    region: 'outpost',
    build: (b, c) => {
      for (const e of c.level.map.entities) {
        if (e.type !== 'checkpoint' || e.area.shape !== 'circle') continue;
        crate(b, e.area.center.x + 0.16, 0, e.area.center.z - 0.28, 0.12, 0.2);
      }
      const p = c.beyond(0.85);
      gateFrame(b, p.x, 0, p.z, c.facing + Math.PI / 2, 1.0, 0.7, 'glowCyan');
      tent(b, -1.6, 1.8, 0, '#e2e8f0');
      tent(b, -0.9, 1.9, 0.4, '#e2e8f0');
      building(b, 0.9, 0, 1.9, 1.0, 0.5, 0.6, Math.PI, '#e2e8f0', 'glowCyan');
    },
  },
  'starter-fallen-trees': {
    region: 'outpost',
    build: (b, c) => {
      for (const e of c.level.map.entities) {
        if (e.type !== 'box') continue;
        // Root plate at one end of the trunk, snapped crown at the other (along the trunk's long side).
        const alongX = e.size.x > e.size.z;
        const half = Math.max(e.size.x, e.size.z) / 2;
        rock(b, e.position.x + (alongX ? half + 0.1 : 0), 0, e.position.z + (alongX ? 0 : half + 0.1), 0.16, c.rnd, '#6b4f3a');
        bush(b, e.position.x - (alongX ? half + 0.25 : 0), 0, e.position.z - (alongX ? 0 : half + 0.25), 0.55, c.rnd, LEAF.green);
      }
      const p = c.beyond(0.9);
      building(b, p.x, 0, p.z, 0.8, 0.55, 0.8, c.facing, '#e2e8f0', 'glowCyan');
      beaconMast(b, p.x + 0.5, 0, p.z + 0.55, 1.0, 'glowRed');
    },
  },
  'starter-guide-line': {
    region: 'outpost',
    build: (b, c) => {
      const p = c.beyond(1.0);
      b.add('sphere', 'tintMetal', { p: [p.x, 0, p.z], s: [1.1, 0.8, 1.1], color: '#f1f5f9' });
      b.add('cylinderFloor', 'glowCyan', { p: [p.x, 0.02, p.z], s: [1.12, 0.04, 1.12] }, false);
      radarDish(b, p.x + 0.2, 0, p.z + 0.9, 0.6, 1.1);
      for (const e of c.level.map.entities) {
        if (e.type !== 'line') continue;
        for (const q of e.points) {
          const at = besideCourse(c, q.x, q.z, 1.0);
          if (at) lamp(b, at.x, 0, at.z, Math.PI / 2, 0.6);
        }
      }
    },
  },
  'starter-rescue-city': {
    region: 'city',
    build: (b, c) => {
      const { map } = c.level;
      const hx = map.size.x / 2;
      const hz = map.size.z / 2;
      const zones = map.entities.filter((e) => e.type === 'colorZone');
      // Bays on the last street: x of each green marker (+0.15 back to the bay centre) — never build inside them.
      const bays = zones.filter((e) => String(e.id).startsWith('signal-bay')).map((e) => (e.type === 'colorZone' && e.area.shape === 'rect' ? e.area.center : { x: 0, z: 0 }));
      const inBay = (x: number, z: number) => bays.some((p) => Math.abs(x - (p.x + 0.15)) < 0.75 && z < p.z && z > p.z - 2.2);
      // City blocks: a grid of buildings filling every space the streets leave.
      for (let x = -hx + 0.45; x <= hx - 0.3; x += 0.95) {
        for (let z = -hz + 0.45; z <= hz - 0.3; z += 0.95) {
          const px = x + (c.rnd() - 0.5) * 0.12;
          const pz = z + (c.rnd() - 0.5) * 0.12;
          if (!c.clear(px, pz, 0.6) || inBay(px, pz)) continue;
          const w = 0.55 + c.rnd() * 0.25;
          const h = 0.45 + c.rnd() * 1.1;
          const body = ['#e2e8f0', '#f1f5f9', '#fde68a', '#fecaca', '#cbd5e1', '#d9f99d'][Math.floor(c.rnd() * 6)]!;
          building(b, px, 0, pz, w, h, w * (0.85 + c.rnd() * 0.25), Math.round(c.rnd() * 4) * (Math.PI / 2), body, c.rnd() < 0.5 ? 'glowWarm' : 'glowCyan');
        }
      }
      // Rescue HQ behind the goal bay: big building with a red cross and a helipad on the roof.
      const hq = c.beyond(1.25);
      building(b, hq.x, 0, hq.z, 1.6, 1.2, 0.9, c.facing, '#f8fafc', 'glowCyan');
      b.add('box', 'tintFlat', { p: [hq.x, 0.95, hq.z - c.dir.z * 0.46], s: [0.36, 0.1, 0.02], color: '#dc2626' }, false);
      b.add('box', 'tintFlat', { p: [hq.x, 0.95, hq.z - c.dir.z * 0.46], s: [0.1, 0.36, 0.02], color: '#dc2626' }, false);
      b.add('cylinderFloor', 'concrete', { p: [hq.x, 1.26, hq.z], s: [0.7, 0.02, 0.7] });
      b.add('ring', 'glowGreen', { p: [hq.x, 1.285, hq.z], s: 0.6 }, false);
      beaconMast(b, hq.x + 0.7, 1.26, hq.z, 0.4, 'glowRed');
      // A decoy depot behind the first bay.
      for (const p of bays.slice(0, 1)) building(b, p.x + 0.15, 0, p.z - 1.85, 1.0, 0.6, 0.6, 0, '#e7e5e4', 'glowAmber');
      // Traffic lights beside every junction signal, showing the tile's colour.
      for (const e of zones) {
        if (e.type !== 'colorZone' || e.area.shape !== 'rect' || String(e.id).startsWith('signal-bay')) continue;
        const q = e.area.center;
        for (const [dx, dz] of [[0.95, 0.95], [-0.95, 0.95], [0.95, -0.95], [-0.95, -0.95]] as const) {
          if (!c.clear(q.x + dx, q.z + dz, 0.05)) continue;
          b.add('cylinderLow', 'metalDark', { p: [q.x + dx, 0, q.z + dz], s: [0.03, 0.55, 0.03] });
          b.add('box', 'metalDark', { p: [q.x + dx, 0.6, q.z + dz], s: [0.08, 0.16, 0.08] });
          b.add('sphere', e.color === 'red' ? 'glowRed' : 'glowCyan', { p: [q.x + dx, 0.63, q.z + dz], s: 0.05 }, false);
          break;
        }
      }
    },
  },
} as const satisfies Record<string, Landmark>;

export type RegionEnvironmentId = keyof typeof LANDMARKS;
