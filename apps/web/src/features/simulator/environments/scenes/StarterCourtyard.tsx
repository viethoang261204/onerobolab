import { useMemo } from 'react';
import { EnergyStation } from '../../environment/EnergyStation';
import { seededRandom } from '../../environment/geometry';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { beaconMast, bench, building, crate, fence, lamp, scatter, sign } from '../props/builders';
import { boulder, broadleafTree, FOLIAGE, planterBox, shrub, wildflowers } from '../natural/builders';
import { GrassField } from '../natural/GrassField';
import { pavingTexture } from '../natural/textures';
import { layeredColor, type TerrainField } from '../terrain/fields';
import { Road } from '../terrain/Road';
import { Terrain } from '../terrain/Terrain';
import { DENSITY, type EnvironmentProps } from '../types';
import { courseMask, grassRule, groundAt, landscape, TERRAIN_SIZE } from './common';

/** Real lawn and hill tones (natural look: the ground texture adds soil and blade detail). */
const PALETTE = { floor: '#6e9a47', floor2: '#7da553', low: '#6b5a44', mid: '#6a9448', high: '#5b8440', cliff: '#867d6a', highAt: 2.5 };
/** Slabs are 40 cm (the texture holds 2 × 2 slabs per 0.8 m) — students count them. */
const ROAD = { surface: '#ffffff', edge: '#a8a69e', roughness: 0.85, texture: pavingTexture, tile: 0.8 };
const GRASS = ['#6f9b45', '#7ea84d', '#86ad55', '#64913f'];

/**
 * Mission 1-1 · First Delivery — Starter Base (garage + charging bay), a
 * paved lane with 40 cm slabs, the loading gate at the corner and the
 * Supply Station behind the delivery pad; lawn, planters and trees around.
 */
export default function StarterCourtyard({ level, quality }: EnvironmentProps) {
  const mask = useMemo(() => courseMask(level), [level]);
  const height = useMemo(() => landscape(level, { flat: 1.4, hills: 1.4, horizon: 4.5, seed: 11 }), [level]);
  const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(PALETTE, 7), size: TERRAIN_SIZE }), [height]);
  /** Starter Base's charging bay, beside the start (south of the lane). */
  const base = { x: level.map.start.x - 0.1, z: level.map.start.z + 0.85 };
  const ground = useMemo(() => groundAt(height), [height]);
  const grassHalf = useMemo(() => ({ x: mask.hx + 1.8, z: mask.hz + 1.8 }), [mask]);
  const grassAllowed = useMemo(() => grassRule(level, mask, [base]), [level, mask]);

  const batch = useMemo(() => {
    const b = new PropBatch();
    const rnd = seededRandom(101);
    const y = groundAt(height);
    const k = DENSITY[quality];
    const { hx, hz } = mask;

    // Layout from the level itself: start (Starter Base), the loading corner, the delivery pad.
    const start = level.map.start;
    const pad = level.map.finish.center;
    const path = level.scene.path;
    const corner = path[1] ?? pad;
    // Starter Base: the garage the robot rolls out of, its charging bay beside it.
    // (beside the lane, not behind the robot: the chase camera looks over the start).
    building(b, base.x + 0.95, 0, base.z + 0.2, 0.95, 0.5, 0.65, Math.PI, '#e2e8f0', 'glowCyan');
    b.add('box', 'tintFlat', { p: [base.x + 0.95, 0.42, base.z - 0.13], s: [0.6, 0.1, 0.02], color: '#2563eb' }, false);
    sign(b, start.x - 0.25, 0, start.z - 0.7, 0, '#2563eb');
    // Supply Station: the warehouse behind the delivery pad, roller door facing the robot.
    building(b, pad.x, 0, pad.z - 1.55, 1.7, 0.8, 1.1, 0, '#f1f5f9', 'glowWarm');
    b.add('box', 'tintFlat', { p: [pad.x, 0.66, pad.z - 0.99], s: [0.9, 0.12, 0.02], color: '#f59e0b' }, false);
    // Loading gate at the corner: two posts and a hazard bar overhead.
    for (const k of [-1, 1]) b.add('boxFloor', 'metalDark', { p: [corner.x - 0.15, 0, corner.z + k * 0.47], s: [0.05, 0.62, 0.05] });
    b.add('box', 'hazard', { p: [corner.x - 0.15, 0.62, corner.z], s: [0.06, 0.06, 0.98] });
    // Lamps along the lane (outside the kerb hedges).
    for (let x = start.x + 0.2; x < corner.x - 0.3; x += 0.9) lamp(b, x, 0, start.z + 0.68, -Math.PI / 2);
    lamp(b, corner.x + 0.68, 0, (corner.z + pad.z) / 2, Math.PI);
    // Stacked supply crates waiting at the station.
    for (const [dx, dz, s] of [[0.75, -0.75, 0.16], [0.95, -0.75, 0.14], [0.85, -0.75, 0.13]] as const) crate(b, pad.x + dx, dx === 0.85 ? 0.16 : 0, pad.z + dz, s, 0.3);
    bench(b, start.x + 1.0, 0, start.z - 0.75, 0);
    for (const [px, pz] of [
      [start.x + 0.3, start.z - 0.75],
      [corner.x + 0.75, corner.z + 0.75],
      [pad.x - 0.75, pad.z + 0.6],
      [pad.x + 0.75, pad.z + 0.35],
    ] as const)
      planterBox(b, px, 0, pz, rnd, 0.28);
    beaconMast(b, -2.75, 0, -1.95, 1.4, 'glowRed');
    beaconMast(b, 2.8, 0, -0.2, 1.1, 'glowCyan');
    // Low perimeter fence marks the edge of the course.
    const e = { x: hx + 0.08, z: hz + 0.08 };
    fence(b, { x: -e.x, z: -e.z }, { x: e.x, z: -e.z });
    fence(b, { x: -e.x, z: e.z }, { x: e.x, z: e.z });
    fence(b, { x: -e.x, z: -e.z }, { x: -e.x, z: e.z });
    fence(b, { x: e.x, z: -e.z }, { x: e.x, z: e.z });

    // Lawn dressing inside the courtyard.
    for (const p of scatter(rnd, Math.round(34 * k), Math.max(hx, hz), (x, z) => mask.inBounds(x, z) && mask.free(x, z, 0.3))) {
      if (rnd() < 0.55) wildflowers(b, p.x, 0, p.z, rnd);
      else shrub(b, p.x, 0, p.z, 0.8 + rnd() * 0.5, rnd);
    }
    // Trees and rocks on the hills around.
    for (const p of scatter(rnd, Math.round(110 * k), 13, (x, z) => !mask.inBounds(x, z, 0.4) && Math.hypot(x, z) > 3.4 && mask.clearView(x, z))) {
      if (rnd() < 0.85) broadleafTree(b, p.x, y(p.x, p.z), p.z, 1.0 + rnd() * 0.8, rnd, rnd() < 0.2 ? FOLIAGE.birch : FOLIAGE.summer, false);
      else boulder(b, p.x, y(p.x, p.z), p.z, 0.25 + rnd() * 0.3, rnd);
    }
    return b;
  }, [level, quality, mask, height]);

  return (
    <>
      <Terrain field={field} quality={quality} natural />
      <Road path={level.scene.path} width={level.scene.pathWidth} style={ROAD} />
      <BatchMesh batch={batch} />
      <GrassField half={grassHalf} allow={grassAllowed} ground={ground} palette={GRASS} quality={quality} seed={101} />
      {/* The robot's charging bay at Starter Base. */}
      <EnergyStation position={[base.x, 0.004, base.z]} rotation={0} scale={1.0} />
    </>
  );
}
