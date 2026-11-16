import type { WorldTheme } from '../../../content/worlds/types';
import { seededRandom } from '../../simulator/environment/geometry';
import { PropBatch, type MatKey } from '../../simulator/environments/props/batch';
import { barrel, beaconMast, building, bush, chargingStation, container, crate, flowerPatch, jungleTree, lamp, pillar, pine, radarDish, rock, tank, temple, tree, tuft, warningSign } from '../../simulator/environments/props/builders';
import { hex, mixRgb } from '../../simulator/environments/terrain/fields';
import { ISLAND_RADIUS } from './island-decor';

/*
 * Handcrafted island dioramas — one small place per world, laid out by hand
 * (asymmetric, with little stories: a rover parked at its charger, a bridge
 * over the pond, a snow buggy by the research hut, vines on a broken temple,
 * a maintenance bot by the lava pipeline). Island-local units (radius 2,
 * +Z towards the camera); the centre pad (r < 0.55) stays free for the robot.
 * Pure data → one PropBatch → a few instanced draw calls per island.
 */

type Rnd = () => number;
type Ground = (x: number, z: number) => number;

const TAU = Math.PI * 2;

// ── small set-piece builders (island scale) ─────────────────────────────

/** Mini rover robot (two-tone body, cyan visor, four wheels). */
function miniRover(b: PropBatch, x: number, y: number, z: number, yaw: number, s = 1, body = '#f1f5f9', accent = '#2563eb') {
  const f = (d: number) => [x + Math.cos(yaw) * d, z - Math.sin(yaw) * d] as const;
  b.add('boxFloor', 'tint', { p: [x, y + 0.035 * s, z], r: yaw, s: [0.2 * s, 0.07 * s, 0.14 * s], color: body });
  b.add('boxFloor', 'tint', { p: [x, y + 0.105 * s, z], r: yaw, s: [0.1 * s, 0.05 * s, 0.1 * s], color: accent });
  const [vx, vz] = f(0.051 * s);
  b.add('box', 'glowCyan', { p: [vx, y + 0.13 * s, vz], r: yaw, s: [0.004, 0.018 * s, 0.07 * s] }, false);
  for (const [a, c] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const px = x + Math.cos(yaw) * 0.07 * a * s + Math.sin(yaw) * 0.075 * c * s;
    const pz = z - Math.sin(yaw) * 0.07 * a * s + Math.cos(yaw) * 0.075 * c * s;
    b.add('cylinderLow', 'tint', { p: [px, y + 0.035 * s, pz], r: [Math.PI / 2, yaw, 0], s: [0.07 * s, 0.035 * s, 0.07 * s], color: '#1f2937' });
  }
}

function windTurbine(b: PropBatch, x: number, y: number, z: number, h: number, rnd: Rnd) {
  b.add('cylinderLow', 'tint', { p: [x, y, z], s: [0.05, h, 0.05], color: '#f1f5f9' });
  b.add('box', 'tint', { p: [x, y + h, z], s: [0.08, 0.06, 0.12], color: '#e2e8f0' });
  const a0 = rnd() * TAU;
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k * TAU) / 3;
    b.add('box', 'tint', { p: [x + Math.cos(a) * 0.14, y + h + Math.sin(a) * 0.14, z + 0.07], r: [0, 0, a], s: [0.28, 0.025, 0.01], color: '#ffffff' });
  }
}

function solarRow(b: PropBatch, x: number, y: number, z: number, yaw: number, n: number) {
  for (let k = 0; k < n; k++) {
    const px = x + Math.cos(yaw) * k * 0.17;
    const pz = z - Math.sin(yaw) * k * 0.17;
    b.add('boxFloor', 'metalDark', { p: [px, y, pz], s: [0.015, 0.06, 0.015] });
    b.add('box', 'tintMetal', { p: [px, y + 0.07, pz], r: [-0.55, yaw, 0], s: [0.15, 0.008, 0.1], color: '#1e40af' });
  }
}

/** Plank bridge from a to b (heights ya → yb), with posts. */
function plankBridge(b: PropBatch, a: readonly [number, number], c: readonly [number, number], ya: number, yb: number, width: number, mat: MatKey = 'wood') {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const yaw = -Math.atan2(c[1] - a[1], c[0] - a[0]);
  const n = Math.max(3, Math.round(len / 0.07));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (c[0] - a[0]) * t;
    const z = a[1] + (c[1] - a[1]) * t;
    const y = ya + (yb - ya) * t + Math.sin(t * Math.PI) * 0.03;
    b.add('box', mat, { p: [x, y, z], r: yaw, s: [0.045, 0.02, width] });
    if (i % 3 === 0)
      for (const k of [-1, 1]) b.add('boxFloor', 'woodDark', { p: [x - Math.sin(yaw) * k * width * 0.5, y - 0.02, z - Math.cos(yaw) * k * width * 0.5], s: [0.02, 0.1, 0.02] });
  }
}

/** Dirt / snow / stone path through points (flat strips hugging the ground). */
function path(b: PropBatch, pts: readonly (readonly [number, number])[], width: number, color: string, g: Ground) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]!;
    const [cx, cz] = pts[i + 1]!;
    const len = Math.hypot(cx - ax, cz - az);
    const n = Math.max(1, Math.round(len / 0.16));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = ax + (cx - ax) * t;
      const z = az + (cz - az) * t;
      b.add('box', 'tintFlat', { p: [x, g(x, z) + 0.008, z], r: -Math.atan2(cz - az, cx - ax), s: [len / n + 0.03, 0.012, width], color }, false);
    }
  }
}

function cone(b: PropBatch, x: number, y: number, z: number) {
  b.add('coneLow', 'tintFlat', { p: [x, y, z], s: [0.05, 0.09, 0.05], color: '#f97316' });
  b.add('coneLow', 'tintFlat', { p: [x, y + 0.035, z], s: [0.034, 0.02, 0.034], color: '#ffffff' }, false);
}

function spire(b: PropBatch, x: number, y: number, z: number, h: number, rnd: Rnd, colors: readonly string[]) {
  let yy = y;
  let w = 0.26 * h;
  for (let k = 0; k < 3; k++) {
    const hh = h * (0.45 - k * 0.1);
    b.add('boxFloor', 'tintFlat', { p: [x + (rnd() - 0.5) * 0.03, yy, z], r: rnd() * TAU, s: [w, hh, w * (0.8 + rnd() * 0.3)], color: colors[k % colors.length]! });
    yy += hh;
    w *= 0.72;
  }
}

function snowRock(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd) {
  rock(b, x, y, z, s, rnd, '#8fa6c0');
  b.add('icosa', 'tintFlat', { p: [x, y + s * 0.42, z], r: rnd() * TAU, s: [s * 0.8, s * 0.25, s * 0.7], color: '#ffffff' });
}

function iceCrystal(b: PropBatch, x: number, y: number, z: number, s: number, rnd: Rnd) {
  b.add('octa', 'ice', { p: [x, y + 0.14 * s, z], r: [0.2, rnd() * TAU, 0.15], s: [0.07 * s, 0.22 * s, 0.07 * s] });
  b.add('octa', 'ice', { p: [x + 0.05 * s, y + 0.08 * s, z + 0.03 * s], r: [-0.4, rnd() * TAU, 0.3], s: [0.045 * s, 0.13 * s, 0.045 * s] });
}

function vine(b: PropBatch, x: number, y: number, z: number, len: number) {
  b.add('cylinderLow', 'tintFlat', { p: [x, y - len, z], s: [0.012, len, 0.012], color: '#3f7f3a' }, false);
  b.add('icosa', 'tintFlat', { p: [x, y - len, z], s: 0.025, color: '#4ea847' }, false);
}

// ── the six places ───────────────────────────────────────────────────────

function starter(b: PropBatch, g: Ground, rnd: Rnd) {
  // Road from the front edge past the pad to the garage.
  path(b, [[1.25, 1.45], [0.75, 0.75], [0.62, 0.05], [0.8, -0.55], [0.95, -0.9]], 0.2, '#d6b98a', g);
  path(b, [[-0.55, 0.35], [-1.0, 0.9], [-0.7, 1.4]], 0.16, '#d6b98a', g);
  // Robot garage + charger with a rover parked at it.
  building(b, 1.05, g(1.05, -1.05), -1.05, 0.55, 0.34, 0.44, -0.55, '#e2e8f0', 'glowCyan');
  b.add('box', 'metalDark', { p: [0.86, g(0.86, -0.87) + 0.12, -0.87], r: -0.55, s: [0.02, 0.22, 0.26] });
  chargingStation(b, 0.4, g(0.4, -1.28), -1.28, 0.3, 0.55);
  miniRover(b, 0.4, g(0.4, -1.28) + 0.02, -1.28, 0.9);
  solarRow(b, 1.45, g(1.45, -0.45), -0.45, 1.1, 3);
  // Launch pad with a waiting rover.
  const px = 1.2;
  const pz = 0.4;
  b.add('hexFloor', 'concrete', { p: [px, g(px, pz) - 0.02, pz], s: [0.62, 0.05, 0.62] });
  b.add('ring', 'glowCyan', { p: [px, g(px, pz) + 0.035, pz], s: [0.52, 1, 0.52] }, false);
  miniRover(b, px, g(px, pz) + 0.03, pz, 2.4, 0.9, '#f8fafc', '#16a34a');
  // Training course: cones and a sign.
  for (const [x, z] of [[-0.95, 0.65], [-0.75, 0.95], [-1.05, 1.15], [-0.8, 1.35]] as const) cone(b, x, g(x, z), z);
  lamp(b, -0.45, g(-0.45, 0.65), 0.65, 0, 0.32);
  // Wooden bridge over the pond outlet.
  plankBridge(b, [-0.55, -0.35], [-0.35, -0.95], g(-0.55, -0.35) + 0.02, g(-0.35, -0.95) + 0.04, 0.16);
  // Wind turbine on the western hill.
  windTurbine(b, -1.45, g(-1.45, 0.2), 0.2, 0.95, rnd);
  // Trees: a grove behind the pond, a few along the edges.
  for (const [x, z, s] of [[-1.45, -0.95, 0.5], [-1.15, -1.35, 0.45], [-1.6, -0.45, 0.42], [-0.65, -1.55, 0.4], [1.55, 1.0, 0.42], [0.25, 1.6, 0.38], [-1.6, 0.95, 0.4]] as const)
    tree(b, x, g(x, z), z, s, rnd);
  for (const [x, z] of [[-1.2, -1.4], [1.6, -0.9]] as const) pine(b, x, g(x, z), z, 0.55, rnd);
  for (const [x, z] of [[0.1, 1.2], [-0.2, -1.2], [1.6, 0.4], [-1.7, 0.45], [0.55, -1.65]] as const) bush(b, x, g(x, z), z, 0.55, rnd);
  for (const [x, z] of [[0.35, 1.35], [-1.3, 0.55], [1.4, 1.35]] as const) flowerPatch(b, x, g(x, z), z, rnd);
  for (const [x, z] of [[1.75, 0.1], [-0.2, 1.75], [-1.8, -0.1]] as const) rock(b, x, g(x, z), z, 0.14, rnd);
}

function canyon(b: PropBatch, g: Ground, rnd: Rnd) {
  const rust = ['#b4552f', '#c8703e', '#d9894f'];
  // Road along the canyon floor with a buggy on it.
  path(b, [[-1.8, -0.8], [-0.9, -0.55], [0.2, -1.02], [1.2, -0.62], [1.85, -0.85]], 0.22, '#e8c28e', g);
  miniRover(b, -0.35, g(-0.35, -0.72) + 0.012, -0.72, -0.3, 1, '#facc15', '#1f2937');
  // A plank bridge across the canyon between the two plateaus.
  plankBridge(b, [0.75, -0.2], [0.8, -1.45], g(0.75, -0.2) + 0.01, g(0.8, -1.45) + 0.01, 0.16);
  // Ramp from the floor up to the western plateau.
  b.add('box', 'wood', { p: [-1.35, g(-1.35, -0.5) + 0.12, -0.3], r: [0.5, 0.3, 0], s: [0.2, 0.02, 0.42] });
  // Hoodoos and spires.
  spire(b, -1.25, g(-1.25, 1.0), 1.0, 0.9, rnd, rust);
  spire(b, 1.4, g(1.4, 0.75), 0.75, 0.75, rnd, rust);
  spire(b, -1.7, g(-1.7, 0.1), 0.1, 0.55, rnd, rust);
  // Old mine: headframe, cart rails, crates, barrels.
  const mx = 1.3;
  const mz = 0.05;
  const my = g(mx, mz);
  for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]] as const) b.add('boxFloor', 'woodDark', { p: [mx + dx, my, mz + dz], r: [dx * 1.2, 0, -dz * 1.2], s: [0.025, 0.45, 0.025] });
  b.add('box', 'woodDark', { p: [mx, my + 0.44, mz], s: [0.26, 0.03, 0.26] });
  b.add('cylinder', 'metal', { p: [mx, my + 0.5, mz], r: [Math.PI / 2, 0, 0], s: [0.1, 0.04, 0.1] });
  for (let k = 0; k < 4; k++) b.add('box', 'metalDark', { p: [mx - 0.2 - k * 0.12, my + 0.01, mz + 0.3], s: [0.1, 0.012, 0.1] }, false);
  b.add('boxFloor', 'tint', { p: [mx - 0.45, my + 0.02, mz + 0.3], s: [0.12, 0.07, 0.09], color: '#7c5a3c' });
  crate(b, 1.0, g(1.0, 0.45), 0.45, 0.1, 0.3, '#b87a3e');
  crate(b, 1.12, g(1.12, 0.52), 0.52, 0.09, -0.2, '#c98a4b');
  barrel(b, 0.9, g(0.9, 0.62), 0.62, 0.35, '#dc2626');
  // Sensor towers on the rims.
  beaconMast(b, 0.25, g(0.25, 0.55), 0.55, 0.5, 'glowAmber');
  beaconMast(b, -0.55, g(-0.55, -1.35), -1.35, 0.42, 'glowAmber');
  warningSign(b, -0.1, g(-0.1, -0.35), -0.35, 0.4);
  // Desert plants and scree.
  for (const [x, z] of [[-0.5, 1.25], [0.55, 1.35], [-1.55, 0.6], [1.7, -0.2]] as const) {
    b.add('cylinderLow', 'tintFlat', { p: [x, g(x, z), z], s: [0.04, 0.18, 0.04], color: '#4f9a4a' });
    b.add('cylinderLow', 'tintFlat', { p: [x + 0.035, g(x, z) + 0.07, z], s: [0.025, 0.08, 0.025], color: '#4f9a4a' });
  }
  for (let k = 0; k < 8; k++) {
    const a = rnd() * TAU;
    const r = 0.9 + rnd() * 0.8;
    rock(b, Math.cos(a) * r, g(Math.cos(a) * r, Math.sin(a) * r), Math.sin(a) * r, 0.07 + rnd() * 0.07, rnd, rust[k % 3]!);
  }
}

function frost(b: PropBatch, g: Ground, rnd: Rnd) {
  // Research hut with a dish and a mast; a snow buggy parked outside.
  const hx = -0.95;
  const hz = 0.5;
  building(b, hx, g(hx, hz), hz, 0.5, 0.3, 0.4, 0.4, '#f8fafc', 'glowWarm');
  b.add('boxFloor', 'tint', { p: [hx, g(hx, hz) + 0.3, hz], r: 0.4, s: [0.56, 0.05, 0.46], color: '#dc2626' });
  radarDish(b, -1.35, g(-1.35, 0.15), 0.15, 0.8, 0.5);
  beaconMast(b, -0.6, g(-0.6, 0.2), 0.2, 0.55, 'glowRed');
  miniRover(b, -0.45, g(-0.45, 0.85) + 0.01, 0.85, -0.6, 1.05, '#f97316', '#1f2937');
  crate(b, -1.25, g(-1.25, 0.8), 0.8, 0.09, 0.2, '#64748b');
  // Snow path from the hut to the lake jetty.
  path(b, [[-0.75, 0.75], [-0.2, 0.95], [0.35, 0.75], [0.6, 0.6]], 0.16, '#cfdcec', g);
  plankBridge(b, [0.55, 0.62], [0.95, 0.45], g(0.55, 0.62) + 0.02, 0.02, 0.14);
  // Ice formations around the frozen lake.
  for (const [x, z, s] of [[1.55, 0.3, 1.2], [1.35, 1.2, 0.9], [0.45, 1.35, 0.8], [1.7, 0.75, 0.7]] as const) iceCrystal(b, x, g(x, z), z, s, rnd);
  // Snowy pines on the slopes, thinning out towards the lake.
  for (const [x, z, s] of [[-1.55, -0.3, 0.55], [-1.25, -0.75, 0.5], [-1.7, 0.45, 0.45], [0.1, -0.55, 0.45], [-0.15, -0.3, 0.4], [1.2, -0.75, 0.5], [1.65, -0.55, 0.45], [-1.3, 1.25, 0.42], [0.05, 1.55, 0.38]] as const)
    pine(b, x, g(x, z), z, s, rnd, true);
  for (const [x, z] of [[0.3, -1.6], [-0.95, -1.4], [1.8, 0.0], [-1.6, 0.9]] as const) snowRock(b, x, g(x, z), z, 0.13, rnd);
  // Expedition flag on the summit.
  b.add('cylinderLow', 'metal', { p: [-0.55, g(-0.55, -1.05), -1.05], s: [0.015, 0.25, 0.015] });
  b.add('box', 'tintFlat', { p: [-0.5, g(-0.55, -1.05) + 0.22, -1.05], s: [0.1, 0.06, 0.006], color: '#2563eb' });
}

function jungle(b: PropBatch, g: Ground, rnd: Rnd) {
  // Stepped temple on the upper terrace, vines and broken columns.
  const tx = -0.95;
  const tz = -0.95;
  temple(b, tx, g(tx, tz), tz, 0.3, 0.32);
  for (const [x, z, l] of [[-0.72, -0.72, 0.16], [-1.15, -0.7, 0.12], [-0.85, -0.68, 0.2]] as const) vine(b, x, g(tx, tz) + 0.35, z, l);
  for (const [x, z, h] of [[-0.3, -0.55, 0.28], [-0.45, -0.3, 0.18], [-1.55, -0.2, 0.34]] as const) pillar(b, x, g(x, z), z, h, rnd);
  b.add('boxFloor', 'tintFlat', { p: [-0.2, g(-0.2, -0.25), -0.25], r: 0.8, s: [0.2, 0.07, 0.1], color: '#9aa391' });
  // Rope bridge over the river; explorer camp with a rover.
  plankBridge(b, [0.45, -0.95], [1.05, -0.25], g(0.45, -0.95) + 0.03, g(1.05, -0.25) + 0.03, 0.14);
  miniRover(b, 0.95, g(0.95, 0.8) + 0.01, 0.8, 2.6, 1, '#fde68a', '#15803d');
  crate(b, 1.25, g(1.25, 0.95), 0.95, 0.09, 0.3, '#a16207');
  crate(b, 1.2, g(1.2, 1.1), 1.1, 0.08, -0.2, '#b87a3e');
  lamp(b, 0.7, g(0.7, 1.05), 1.05, 0, 0.3);
  path(b, [[0.2, 1.5], [0.65, 1.0], [0.9, 0.55], [1.05, -0.2]], 0.14, '#b89a6a', g);
  // Dense canopy: tall jungle trees at the back and sides, lush trees in front.
  for (const [x, z, s] of [[-1.5, -0.9, 0.38], [-0.4, -1.45, 0.34], [0.05, -1.55, 0.3], [-1.65, 0.3, 0.36], [-1.2, 1.1, 0.32], [1.6, -0.9, 0.32]] as const) jungleTree(b, x, g(x, z), z, s, rnd);
  for (const [x, z, s] of [[-0.75, 0.95, 0.45], [-1.45, 0.75, 0.42], [1.55, 0.45, 0.4], [-0.35, 1.45, 0.38]] as const) tree(b, x, g(x, z), z, s, rnd, ['#2e8b47', '#237a3c', '#3a9d52']);
  for (let k = 0; k < 7; k++) {
    const a = rnd() * TAU;
    const r = 0.8 + rnd() * 0.9;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (x > 0.2 && z < 0.4 && z > -1.3) continue; // keep the river bank clear
    if (k % 2) tuft(b, x, g(x, z), z, 0.5, rnd, '#4ea847');
    else bush(b, x, g(x, z), z, 0.5, rnd, ['#2e8b47', '#3a9d52']);
  }
  for (const [x, z] of [[0.5, -0.45], [1.5, 0.05]] as const) rock(b, x, g(x, z), z, 0.1, rnd, '#7c8a7a');
}

function skylab(b: PropBatch, g: Ground, rnd: Rnd) {
  // Main lab on the raised platform, observatory dome, antenna mast.
  building(b, -0.8, g(-0.8, -0.6), -0.6, 0.62, 0.38, 0.46, 0.3, '#eef2f8', 'glowCyan');
  b.add('sphere', 'tintGlossy', { p: [0.95, g(0.95, -0.95) + 0.05, -0.95], s: [0.5, 0.42, 0.5], color: '#e2e8f0' });
  b.add('box', 'metalDark', { p: [1.02, g(0.95, -0.95) + 0.2, -0.78], r: [0.6, 0.4, 0], s: [0.06, 0.24, 0.02] });
  b.add('cylinderLow', 'tint', { p: [0.95, g(0.95, -0.95), -0.95], s: [0.52, 0.07, 0.52], color: '#94a3b8' });
  beaconMast(b, -0.2, g(-0.2, -1.3), -1.3, 0.85, 'glowCyan');
  radarDish(b, 1.35, g(1.35, 0.1), 0.1, 2.4, 0.6);
  radarDish(b, -1.45, g(-1.45, 0.55), 0.55, 0.6, 0.45);
  // Solar field and energy tanks.
  solarRow(b, -1.25, g(-1.25, 1.0), 1.0, 0.2, 4);
  solarRow(b, -1.2, g(-1.2, 1.25), 1.25, 0.2, 3);
  tank(b, 1.5, g(1.5, -0.55), -0.55, 0.1, 0.28, '#dfe4ee');
  tank(b, 1.62, g(1.62, -0.3), -0.3, 0.08, 0.22, '#dfe4ee');
  // Landing pad with a parked scout drone.
  const px = 0.95;
  const pz = 0.95;
  b.add('hexFloor', 'metal', { p: [px, g(px, pz), pz], s: [0.62, 0.04, 0.62] });
  b.add('ring', 'glowCyan', { p: [px, g(px, pz) + 0.045, pz], s: [0.5, 1, 0.5] }, false);
  b.add('boxFloor', 'tint', { p: [px, g(px, pz) + 0.05, pz], r: 0.6, s: [0.12, 0.03, 0.12], color: '#f1f5f9' });
  for (const a of [0.6, 0.6 + Math.PI / 2, 0.6 + Math.PI, 0.6 - Math.PI / 2]) b.add('cylinderLow', 'tintMetal', { p: [px + Math.cos(a + Math.PI / 4) * 0.1, g(px, pz) + 0.08, pz + Math.sin(a + Math.PI / 4) * 0.1], s: [0.06, 0.006, 0.06], color: '#334155' });
  miniRover(b, 0.3, g(0.3, -1.45) + 0.01, -1.45, 0.4, 0.9);
  // A few planters with small trees (the lab is tidy).
  for (const [x, z] of [[0.2, 1.4], [-0.35, 1.5], [1.6, 0.6]] as const) {
    b.add('cylinderLow', 'concrete', { p: [x, g(x, z), z], s: [0.14, 0.06, 0.14] });
    tree(b, x, g(x, z) + 0.06, z, 0.28, rnd, ['#5cc466', '#4cb35a']);
  }
}

function lava(b: PropBatch, g: Ground, rnd: Rnd) {
  // Industrial plant on the flats: hall, tanks, chimney, pipeline into the volcano.
  building(b, 1.05, g(1.05, 0.25), 0.25, 0.56, 0.36, 0.42, -0.4, '#475569', 'glowWarm');
  tank(b, 1.45, g(1.45, -0.45), -0.45, 0.12, 0.34, '#64748b');
  tank(b, 1.15, g(1.15, -0.75), -0.75, 0.1, 0.28, '#64748b');
  b.add('cylinderLow', 'tint', { p: [0.7, g(0.7, 0.5), 0.5], s: [0.08, 0.7, 0.08], color: '#334155' });
  b.add('cylinderLow', 'glowRed', { p: [0.7, g(0.7, 0.5) + 0.7, 0.5], s: [0.085, 0.03, 0.085] }, false);
  const py = g(0.6, -0.55) + 0.18;
  b.add('cylinder', 'tintMetal', { p: [0.95, py, -0.52], r: [0, 0.35, Math.PI / 2], s: [0.05, 0.7, 0.05], color: '#b7c2d6' });
  for (const x of [0.75, 1.1]) b.add('boxFloor', 'metalDark', { p: [x, g(x, -0.5), -0.5], s: [0.03, py - g(x, -0.5), 0.03] });
  // Energy core beside the crater.
  const cx = 0.45;
  const cz = -1.25;
  b.add('cylinderLow', 'metalDark', { p: [cx, g(cx, cz), cz], s: [0.24, 0.08, 0.24] });
  b.add('cylinderLow', 'glass', { p: [cx, g(cx, cz) + 0.08, cz], s: [0.14, 0.32, 0.14] });
  b.add('sphere', 'lava', { p: [cx, g(cx, cz) + 0.24, cz], s: 0.1 }, false);
  // Steel bridge over the lava river; warning lights.
  plankBridge(b, [-1.25, -0.25], [-0.85, 0.35], g(-1.25, -0.25) + 0.03, g(-0.85, 0.35) + 0.03, 0.16, 'metal');
  beaconMast(b, -0.65, g(-0.65, 0.45), 0.45, 0.35, 'glowRed');
  warningSign(b, -1.35, g(-1.35, 0.55), 0.55, 0.5);
  // Maintenance bot by the pipeline, spare parts.
  miniRover(b, 0.55, g(0.55, -0.2) + 0.01, -0.2, 2.2, 1, '#fbbf24', '#1f2937');
  container(b, 1.5, g(1.5, 0.75), 0.75, 0.4, '#b45309', 0.45);
  barrel(b, 1.25, g(1.25, 0.95), 0.95, 0.35, '#475569');
  // Basalt columns and dark rock.
  for (const [x, z, h] of [[-1.5, 1.0, 0.3], [-1.35, 1.1, 0.22], [-1.6, 0.85, 0.18], [0.1, 1.5, 0.2]] as const)
    b.add('cylinderLow', 'tintFlat', { p: [x, g(x, z), z], r: rnd(), s: [0.1, h, 0.1], color: '#2a232c' });
  for (let k = 0; k < 6; k++) {
    const a = rnd() * TAU;
    const r = 1.1 + rnd() * 0.7;
    rock(b, Math.cos(a) * r, g(Math.cos(a) * r, Math.sin(a) * r), Math.sin(a) * r, 0.09 + rnd() * 0.06, rnd, '#3a3040');
  }
}

const BUILD: Readonly<Record<WorldTheme, (b: PropBatch, g: Ground, rnd: Rnd) => void>> = { starter, canyon, frost, jungle, skylab, lava };

const SLATE = hex('#5d6b85');
const GLOWS: readonly MatKey[] = ['glowCyan', 'glowGreen', 'glowAmber', 'glowRed', 'glowWarm', 'glowPurple', 'lava'];

/**
 * Materials folded into flat per-instance colour (glows, glass and ice keep
 * theirs): a diorama costs a handful of draw calls instead of one per
 * builder material — six islands must fit the world-map budget.
 */
const BASE: Partial<Record<MatKey, string>> = {
  tint: '#ffffff',
  tintMetal: '#ffffff',
  tintGlossy: '#ffffff',
  wood: '#a7703f',
  woodDark: '#6d4527',
  trunk: '#7a4f33',
  rock: '#9aa0b5',
  concrete: '#d5dae3',
  metal: '#cfd6e2',
  metalDark: '#3d475d',
  hazard: '#facc15',
};

function flattenBatch(src: PropBatch): PropBatch {
  const out = new PropBatch();
  for (const part of src.parts) {
    const base = BASE[part.material];
    for (const item of part.items) {
      if (!base) out.add(part.geometry, part.material, item, part.shadow);
      else out.add(part.geometry, 'tintFlat', { ...item, color: item.color ?? base }, part.shadow);
    }
  }
  return out;
}

/** Locked worlds: darker, desaturated, no lights. */
function lockBatch(src: PropBatch): PropBatch {
  const out = new PropBatch();
  for (const part of src.parts) {
    const material: MatKey = GLOWS.includes(part.material) ? 'metalDark' : part.material;
    for (const item of part.items) {
      let color = item.color;
      if (color) {
        const m = mixRgb(hex(color), SLATE, 0.38);
        const c = (v: number) => Math.round(Math.min(1, v * 0.82) * 255).toString(16).padStart(2, '0');
        color = `#${c(m[0])}${c(m[1])}${c(m[2])}`;
      }
      out.add(part.geometry, material, color ? { ...item, color } : item, part.shadow);
    }
  }
  return out;
}

/** The handcrafted diorama of one world's island (deterministic). */
export function islandDiorama(theme: WorldTheme, seed: number, ground: Ground, locked = false): PropBatch {
  const b = new PropBatch();
  BUILD[theme](b, ground, seededRandom(seed * 131 + 7));
  const flat = flattenBatch(b);
  return locked ? lockBatch(flat) : flat;
}

/** Everything stays on the island top (for tests). */
export const DIORAMA_RADIUS = ISLAND_RADIUS * 0.95;
