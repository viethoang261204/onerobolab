import { useMemo } from 'react';
import { seededRandom } from '../../environment/geometry';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { bench, building, crate, scatter, sign } from '../props/builders';
import { environmentInfo } from '../catalog';
import { LIGHTING } from '../lighting';
import { boulder, broadleafTree, FOLIAGE, shrub, wildflowers } from '../natural/builders';
import { GrassField } from '../natural/GrassField';
import { NaturalWater } from '../natural/NaturalWater';
import { dirtTexture, groundDetailTexture } from '../natural/textures';
import { layeredColor, type TerrainField } from '../terrain/fields';
import { Road } from '../terrain/Road';
import { Terrain } from '../terrain/Terrain';
import { DENSITY, type EnvironmentProps } from '../types';
import { courseMask, grassRule, groundAt, landscape, TERRAIN_SIZE } from './common';

const PALETTE = { floor: '#6f9a48', floor2: '#7fa553', low: '#6a5a43', mid: '#6b9548', high: '#5a8540', cliff: '#867d6a', highAt: 2.2 };
const ROAD = { surface: '#ffffff', edge: '#8f8a62', roughness: 0.97, texture: dirtTexture, tile: 0.8, edgeTexture: groundDetailTexture };
const GRASS = ['#6e9a45', '#7da64d', '#88ad57', '#62903e', '#8aa752'];

/**
 * Mission 1-3 · Supply Run — a storm-hit meadow trail with rustic fences,
 * a wooden footbridge over the creek, reeds and stones on the banks, and the
 * riverside clinic behind the supply pad.
 */
export default function CreekBridge({ level, quality }: EnvironmentProps) {
  const mask = useMemo(() => courseMask(level), [level]);
  const height = useMemo(() => landscape(level, { flat: 1.0, hills: 1.6, horizon: 5, seed: 37 }), [level]);
  const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(PALETTE, 13), size: TERRAIN_SIZE }), [height]);

  const ground = useMemo(() => groundAt(height), [height]);
  const grassHalf = useMemo(() => ({ x: mask.hx + 1.8, z: mask.hz + 1.8 }), [mask]);
  const grassAllowed = useMemo(() => grassRule(level, mask), [level, mask]);

  const batch = useMemo(() => {
    const b = new PropBatch();
    const rnd = seededRandom(303);
    const y = groundAt(height);
    const k = DENSITY[quality];
    const goal = level.map.finish.center;
    // Riverside clinic behind the supply pad: tent-roofed hall, red cross, crates waiting.
    building(b, goal.x, 0, goal.z - 1.6, 1.6, 0.6, 1.1, 0, '#f8fafc', 'glowWarm');
    b.add('coneLow', 'tintFlat', { p: [goal.x, 0.6, goal.z - 1.6], s: [1.8, 0.32, 1.3], color: '#e2e8f0' });
    b.add('box', 'tintFlat', { p: [goal.x, 0.45, goal.z - 1.04], s: [0.26, 0.08, 0.02], color: '#dc2626' }, false);
    b.add('box', 'tintFlat', { p: [goal.x, 0.45, goal.z - 1.04], s: [0.08, 0.26, 0.02], color: '#dc2626' }, false);
    for (const [dx, s2] of [[0.75, 0.15], [0.95, 0.13]] as const) crate(b, goal.x + dx, 0, goal.z - 0.6, s2, 0.4);
    // Storm debris around the course (the colliding pieces are drawn by the gameplay layer).
    for (let i = 0; i < 5; i++) b.add('cylinder', 'trunk', { p: [-2.2 + i * 0.5, 0.05, 1.85 + (i % 2) * 0.15], r: [Math.PI / 2, rnd() * 3, 0], s: [0.09, 0.45, 0.09] });
    sign(b, level.map.start.x + 0.1, 0, level.map.start.z + 0.95, 0, '#16a34a');
    bench(b, -0.9, 0, 1.85, Math.PI);
    // Creek banks: stones and reeds.
    for (const w of level.scene.water ?? []) {
      for (let i = 0; i + 1 < w.points.length; i++) {
        const a = w.points[i]!;
        const c = w.points[i + 1]!;
        const n = Math.round(Math.hypot(c.x - a.x, c.z - a.z) / 0.3);
        for (let j = 0; j < n; j++) {
          const t = (j + rnd()) / n;
          const px = a.x + (c.x - a.x) * t;
          const side = rnd() < 0.5 ? -1 : 1;
          const pz = a.z + (c.z - a.z) * t + side * (w.width / 2 + 0.05 + rnd() * 0.08);
          if (!mask.free(px, pz, 0.2)) continue;
          if (rnd() < 0.55) boulder(b, px, -0.06, pz, 0.07 + rnd() * 0.08, rnd);
          else shrub(b, px, -0.03, pz, 0.6, rnd, FOLIAGE.hedge);
        }
      }
    }
    // Meadow and orchard.
    for (const p of scatter(rnd, Math.round(70 * k), 3, (x, z) => mask.inBounds(x, z) && mask.free(x, z, 0.3))) {
      const r = rnd();
      if (r < 0.14) broadleafTree(b, p.x, 0, p.z, 0.7 + rnd() * 0.3, rnd, rnd() < 0.3 ? FOLIAGE.autumn : FOLIAGE.summer);
      else if (r < 0.65) wildflowers(b, p.x, 0, p.z, rnd);
      else shrub(b, p.x, 0, p.z, 0.65, rnd);
    }
    for (const p of scatter(rnd, Math.round(120 * k), 13, (x, z) => !mask.inBounds(x, z, 0.3) && Math.hypot(x, z) > 3.3 && mask.waterDist(x, z) > 0.3 && mask.clearView(x, z))) {
      if (rnd() < 0.8) broadleafTree(b, p.x, y(p.x, p.z), p.z, 1.05 + rnd() * 0.8, rnd, FOLIAGE.summer, false);
      else boulder(b, p.x, y(p.x, p.z), p.z, 0.32, rnd);
    }
    return b;
  }, [level, quality, mask, height]);

  return (
    <>
      <Terrain field={field} quality={quality} natural />
      <Road path={level.scene.path} width={level.scene.pathWidth} style={ROAD} />
      <NaturalWater water={level.scene.water ?? []} profile={LIGHTING[environmentInfo(level.environmentId).lighting]} quality={quality} />
      <BatchMesh batch={batch} />
      <GrassField half={grassHalf} allow={grassAllowed} ground={ground} palette={GRASS} quality={quality} seed={303} height={[0.026, 0.05]} />
    </>
  );
}
