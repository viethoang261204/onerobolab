import type { LevelDefinition } from '../../../../../content/levels/types';
import type { Quality } from '../../../../settings/settings-store';
import { seededRandom } from '../../../environment/geometry';
import { PropBatch } from '../../props/batch';
import { broadleafTree, FOLIAGE, shrub } from '../../natural/builders';
import { barrel, beaconMast, bench, building, cactus, container, crate, flowerPatch, lamp, pine, radarDish, rock, scatter, tank, tuft } from '../../props/builders';
import type { HeightFn } from '../../terrain/fields';
import { DENSITY } from '../../types';
import { courseMask, groundAt } from '../common';
import { LANDMARKS, type RegionEnvironmentId } from './landmarks';
import { arrivalDirection, pickWeighted, REGIONS, type SceneryKind } from './regions';

type Rnd = () => number;

/** Stable seed from the environment id (same place → same scenery). */
const seedOf = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 100000;

/** Small parked car: body, cabin, four wheels. */
function car(b: PropBatch, x: number, y: number, z: number, yaw: number, rnd: Rnd) {
  const c = ['#dc2626', '#2563eb', '#f8fafc', '#16a34a', '#f59e0b', '#334155'][Math.floor(rnd() * 6)]!;
  const f = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  b.add('boxFloor', 'tintGlossy', { p: [x, y + 0.03, z], r: yaw, s: [0.34, 0.08, 0.17], color: c });
  b.add('boxFloor', 'glass', { p: [x - f.x * 0.02, y + 0.11, z - f.z * 0.02], r: yaw, s: [0.18, 0.07, 0.15] });
  for (const [dx, dz] of [[0.11, 0.08], [0.11, -0.08], [-0.11, 0.08], [-0.11, -0.08]] as const)
    b.add('box', 'metalDark', { p: [x + f.x * dx + f.z * dz, y + 0.035, z + f.z * dx - f.x * dz], r: yaw, s: [0.07, 0.07, 0.03] });
}

function place(b: PropBatch, kind: SceneryKind, x: number, y: number, z: number, rnd: Rnd, far: boolean, stone: string) {
  const big = far ? 1.4 : 1;
  switch (kind) {
    case 'tree':
      return broadleafTree(b, x, y, z, (0.72 + rnd() * 0.36) * big, rnd, FOLIAGE.summer, !far);
    case 'autumnTree':
      return broadleafTree(b, x, y, z, (0.72 + rnd() * 0.36) * big, rnd, FOLIAGE.autumn, !far);
    case 'pine':
      return pine(b, x, y, z, (0.7 + rnd() * 0.5) * big, rnd);
    case 'bush':
      return shrub(b, x, y, z, 0.52 + rnd() * 0.25, rnd, FOLIAGE.hedge);
    case 'tuft':
      return tuft(b, x, y, z, 0.9, rnd);
    case 'flowers':
      return flowerPatch(b, x, y, z, rnd);
    case 'rock':
      return rock(b, x, y, z, (0.1 + rnd() * 0.12) * (far ? 2.5 : 1), rnd, stone);
    case 'reeds':
      return tuft(b, x, y, z, 1.3, rnd, '#4f9a3f');
    case 'cactus':
      return cactus(b, x, y, z, 0.6 + rnd() * 0.4, rnd);
    case 'crate':
      return crate(b, x, y, z, 0.12 + rnd() * 0.06, rnd() * 3);
    case 'barrel':
      return barrel(b, x, y, z, 0.8, rnd() < 0.5 ? '#2563eb' : '#dc2626');
    case 'lamp':
      return lamp(b, x, y, z, rnd() * 6);
    case 'container':
      return container(b, x, y, z, rnd() * 3, ['#d9573b', '#2563eb', '#16a34a', '#f59e0b'][Math.floor(rnd() * 4)]);
    case 'tank':
      return tank(b, x, y, z, 0.25 + rnd() * 0.1, 0.6 + rnd() * 0.3);
    case 'radar':
      return radarDish(b, x, y, z, rnd() * 6, 1.2);
    case 'mast':
      return beaconMast(b, x, y, z, 1.2 + rnd() * 0.6, 'glowRed');
    case 'bench':
      return bench(b, x, y, z, rnd() * 6);
    case 'mushroom':
      b.add('cylinderLow', 'tintFlat', { p: [x, y, z], s: [0.03, 0.06, 0.03], color: '#f5f5f4' });
      b.add('sphere', 'tintFlat', { p: [x, y + 0.06, z], s: [0.09, 0.05, 0.09], color: rnd() < 0.6 ? '#dc2626' : '#f59e0b' });
      return;
    case 'log':
      b.add('cylinder', 'trunk', { p: [x, y + 0.05, z], r: [Math.PI / 2, rnd() * 3, 0], s: [0.1, 0.5, 0.1] });
      return;
    case 'tower': {
      const w = 0.7 + rnd() * 0.6;
      return building(b, x, y, z, w, 1.6 + rnd() * 2.4, w * (0.8 + rnd() * 0.4), Math.round(rnd() * 4) * (Math.PI / 2), ['#e2e8f0', '#cbd5e1', '#dbeafe', '#fde68a', '#e7e5e4'][Math.floor(rnd() * 5)], rnd() < 0.5 ? 'glowWarm' : 'glowCyan');
    }
    case 'car':
      return car(b, x, y, z, rnd() * Math.PI * 2, rnd);
  }
}

/**
 * All static props of a Starter Island region environment: the mission's
 * landmark, stones and reeds along any water, and the region's scenery
 * scattered around the course (tall props kept out of the chase camera's
 * sight line). Pure — rendered by `RegionScene` as one `BatchMesh`.
 */
export function buildRegionProps(level: LevelDefinition, envId: RegionEnvironmentId, quality: Quality, height: HeightFn): PropBatch {
  const landmark = LANDMARKS[envId];
  const preset = REGIONS[landmark.region];
  const mask = courseMask(level);
  const b = new PropBatch();
  const rnd = seededRandom(seedOf(envId));
  const y = groundAt(height);
  const k = DENSITY[quality];
  const goal = level.map.finish.center;
  const dir = arrivalDirection(level.scene);

  // The landmark is laid out from the goal and the arriving road; on courses that fold back on
  // themselves a piece could land on another stretch of road — those pieces are left out.
  const lm = new PropBatch();
  landmark.build(lm, {
    level,
    rnd,
    goal,
    dir,
    facing: Math.atan2(-dir.x, -dir.z),
    beyond: (d, s = 0) => ({ x: goal.x + dir.x * d + dir.z * s, z: goal.z + dir.z * d - dir.x * s }),
    y,
    clear: (x, z, margin = 0.2) => mask.free(x, z, margin),
  });
  const half = level.scene.pathWidth / 2 + 0.02;
  for (const part of lm.parts) {
    for (const it of part.items) {
      const low = it.p[1] > -0.35 && it.p[1] < 0.3;
      if (low && mask.pathDist(it.p[0], it.p[2]) < half) continue;
      b.add(part.geometry, part.material, it, part.shadow);
    }
  }

  // Banks: stones and reeds along every water channel.
  for (const w of level.scene.water ?? []) {
    for (let i = 0; i + 1 < w.points.length; i++) {
      const a = w.points[i]!;
      const c = w.points[i + 1]!;
      const n = Math.round(Math.hypot(c.x - a.x, c.z - a.z) / 0.35);
      for (let j = 0; j < n; j++) {
        const t = (j + rnd()) / n;
        const side = rnd() < 0.5 ? -1 : 1;
        const l = Math.hypot(c.x - a.x, c.z - a.z) || 1;
        const off = side * (w.width / 2 + 0.06 + rnd() * 0.1);
        const px = a.x + (c.x - a.x) * t - ((c.z - a.z) / l) * off;
        const pz = a.z + (c.z - a.z) * t + ((c.x - a.x) / l) * off;
        if (!mask.free(px, pz, 0.2) || mask.onAnyBridge(px, pz, 0.2)) continue;
        if (rnd() < 0.5) rock(b, px, -0.05, pz, 0.06 + rnd() * 0.07, rnd, preset.stone);
        else tuft(b, px, -0.02, pz, 1.2, rnd, '#4f9a3f');
      }
    }
  }

  // Near the course: low scenery only (count grows with the course area — the city is big).
  const area = Math.max(1, (mask.hx * mask.hz) / 6.6);
  for (const p of scatter(rnd, Math.round(preset.nearCount * k * area), Math.max(3.2, Math.max(mask.hx, mask.hz) + 0.4), (x, z) => mask.inBounds(x, z, 0.4) && mask.free(x, z, 0.3) && mask.waterDist(x, z) > 0.2)) {
    place(b, pickWeighted(preset.near, rnd()), p.x, 0, p.z, rnd, false, preset.stone);
  }
  // Beyond the course: the region's big scenery, clear of the chase camera.
  for (const p of scatter(rnd, Math.round(preset.farCount * k), 12, (x, z) => !mask.inBounds(x, z, 0.5) && Math.hypot(x, z) > 3.2 && mask.waterDist(x, z) > 0.3 && mask.clearView(x, z))) {
    place(b, pickWeighted(preset.far, rnd()), p.x, y(p.x, p.z), p.z, rnd, true, preset.stone);
  }
  return b;
}
