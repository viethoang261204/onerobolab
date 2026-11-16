import { useMemo } from 'react';
import { EnergyStation } from '../../environment/EnergyStation';
import { seededRandom } from '../../environment/geometry';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { beaconMast, building, lamp, pipe, scatter, sign, tank, warningSign } from '../props/builders';
import { boulder, broadleafTree, FOLIAGE, shrub, wildflowers } from '../natural/builders';
import { GrassField } from '../natural/GrassField';
import { asphaltTexture } from '../natural/textures';
import { layeredColor, type TerrainField } from '../terrain/fields';
import { Road } from '../terrain/Road';
import { Terrain } from '../terrain/Terrain';
import { DENSITY, type EnvironmentProps } from '../types';
import { courseMask, grassRule, groundAt, landscape, TERRAIN_SIZE } from './common';

const PALETTE = { floor: '#6b9846', floor2: '#79a250', low: '#6b5a44', mid: '#679246', high: '#58823f', cliff: '#867d6a', highAt: 2.5 };
/** Service lanes: asphalt; 40 cm per texture tile edge band helps counting. */
const ROAD = { surface: '#ffffff', edge: '#b9b6ad', roughness: 0.92, texture: asphaltTexture, tile: 0.8 };
const GRASS = ['#6c9944', '#7aa64c', '#84ab53', '#5f8d3d'];

/**
 * Mission 1-2 · Power Station — the island's power yard: hedge-lined service
 * lanes, two transformers beside the inspection waypoints, pylons with
 * cables, the power station behind the charging pad. Everything is placed
 * from the level's own route and checkpoints.
 */
export default function CampusCrossing({ level, quality }: EnvironmentProps) {
  const mask = useMemo(() => courseMask(level), [level]);
  const height = useMemo(() => landscape(level, { flat: 1.2, hills: 1.1, horizon: 4, seed: 23 }), [level]);
  const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(PALETTE, 9), size: TERRAIN_SIZE }), [height]);
  const pad = level.map.finish.center;
  /** The charging dock, just past the pad (the pad itself is the goal marker). */
  const dock = { x: pad.x, z: pad.z + 0.55 };

  const ground = useMemo(() => groundAt(height), [height]);
  const grassHalf = useMemo(() => ({ x: mask.hx + 1.8, z: mask.hz + 1.8 }), [mask]);
  const grassAllowed = useMemo(() => grassRule(level, mask, [dock]), [level, mask, dock.x, dock.z]);

  const batch = useMemo(() => {
    const b = new PropBatch();
    const rnd = seededRandom(202);
    const y = groundAt(height);
    const k = DENSITY[quality];
    const start = level.map.start;
    // Power station: the hall behind the charging pad, door facing the robot.
    building(b, pad.x, 0, pad.z + 1.6, 1.8, 0.9, 1.1, Math.PI, '#e5e7eb', 'glowAmber');
    b.add('box', 'hazard', { p: [pad.x, 0.75, pad.z + 1.04], s: [0.9, 0.08, 0.02] }, false);
    // Transformers beside each inspection waypoint (outside the hedges), with insulators.
    const cps = level.map.entities.filter((e) => e.type === 'checkpoint');
    cps.forEach((cp, i) => {
      if (cp.type !== 'checkpoint' || cp.area.shape !== 'circle') return;
      const c = cp.area.center;
      const spot = i === 0 ? { x: c.x - 0.75, z: c.z } : { x: c.x, z: c.z - 0.75 };
      b.add('boxFloor', 'concrete', { p: [spot.x, 0, spot.z], s: [0.42, 0.06, 0.42] });
      b.add('boxFloor', 'tintMetal', { p: [spot.x, 0.06, spot.z], s: [0.3, 0.3, 0.26], color: '#64748b' });
      for (const dx of [-0.08, 0, 0.08]) b.add('cylinderLow', 'tintGlossy', { p: [spot.x + dx, 0.36, spot.z], s: [0.03, 0.1, 0.03], color: '#b45309' });
      warningSign(b, spot.x + 0.22, 0, spot.z + 0.22, 0);
    });
    // Pylons and cables across the yard (outside the course).
    const pylons = [
      { x: -2.75, z: -1.9 },
      { x: -0.4, z: -1.95 },
      { x: 2.2, z: -1.6 },
      { x: 2.6, z: 1.9 },
    ];
    for (const p of pylons) {
      b.add('boxFloor', 'metalDark', { p: [p.x, 0, p.z], s: [0.06, 1.7, 0.06] });
      b.add('box', 'metalDark', { p: [p.x, 1.6, p.z], s: [0.5, 0.04, 0.04] });
    }
    for (let i = 0; i + 1 < pylons.length; i++) {
      const a = pylons[i]!;
      const c = pylons[i + 1]!;
      for (const s of [-0.22, 0.22]) pipe(b, [a.x + s, 1.6, a.z], [c.x + s, 1.55, c.z], 0.006, '#1f2937');
    }
    tank(b, 2.3, 0, -0.6, 0.28, 0.7, '#e2e8f0');
    beaconMast(b, 2.75, 0, 0.4, 1.2, 'glowAmber');
    // Lamps along the first lane, the yard sign at the start.
    for (let x = start.x + 0.4; x < -1.5; x += 0.9) lamp(b, x, 0, start.z + 0.68, -Math.PI / 2);
    sign(b, start.x + 0.2, 0, start.z - 0.68, 0, '#f59e0b');

    // Lawn dressing (off the lanes), trees and rocks on the hills.
    for (const p of scatter(rnd, Math.round(30 * k), 2.8, (x, z) => mask.inBounds(x, z) && mask.free(x, z, 0.35) && Math.hypot(x - dock.x, z - dock.z) > 0.6)) {
      if (rnd() < 0.5) shrub(b, p.x, 0, p.z, 0.9, rnd);
      else wildflowers(b, p.x, 0, p.z, rnd);
    }
    for (const p of scatter(rnd, Math.round(120 * k), 13, (x, z) => !mask.inBounds(x, z, 0.4) && Math.hypot(x, z) > 3.4 && mask.clearView(x, z))) {
      if (rnd() < 0.8) broadleafTree(b, p.x, y(p.x, p.z), p.z, 1.0 + rnd() * 0.8, rnd, rnd() < 0.15 ? FOLIAGE.autumn : FOLIAGE.summer, false);
      else if (rnd() < 0.5) shrub(b, p.x, y(p.x, p.z), p.z, 1.6, rnd);
      else boulder(b, p.x, y(p.x, p.z), p.z, 0.3, rnd);
    }
    return b;
  }, [level, quality, mask, height, pad.x, pad.z, dock.x, dock.z]);

  return (
    <>
      <Terrain field={field} quality={quality} natural />
      <Road path={level.scene.path} width={level.scene.pathWidth} style={ROAD} />
      <BatchMesh batch={batch} />
      <GrassField half={grassHalf} allow={grassAllowed} ground={ground} palette={GRASS} quality={quality} seed={202} />
      <EnergyStation position={[dock.x, 0.004, dock.z]} rotation={Math.PI / 2} scale={1.1} />
    </>
  );
}
