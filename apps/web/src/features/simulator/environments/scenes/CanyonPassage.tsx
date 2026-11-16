import { useMemo } from 'react';
import { seededRandom } from '../../environment/geometry';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { barrel, beaconMast, cactus, crate, pipe, rock, scatter, warningSign } from '../props/builders';
import { carveWater, distToPolyline, fbm, layeredColor, smoothstep, type HeightFn, type TerrainField } from '../terrain/fields';
import { Road } from '../terrain/Road';
import { Terrain } from '../terrain/Terrain';
import { Water } from '../terrain/Water';
import { DENSITY, type EnvironmentProps } from '../types';
import { courseMask, groundAt, TERRAIN_SIZE } from './common';

const PALETTE = { floor: '#d9985e', floor2: '#cf8a52', low: '#8a5a38', mid: '#d88a4e', high: '#e6a766', cliff: '#b8582f', strata: '#e7b27a', highAt: 1.8 };
const ROAD = { surface: '#c78d59', edge: '#9e6a3f', roughness: 1 };
const WATER = { deep: '#1f7a8c', shallow: '#56c2cf' };

/** Terraced cliffs rising right beside the switchback road. */
function canyonHeight(level: EnvironmentProps['level']): HeightFn {
  const path = level.scene.path;
  return (x, z) => {
    const d = distToPolyline({ x, z }, path);
    // Low first wall beside the road (keeps the robot in view), a higher tier behind it.
    const rise = Math.max(0, d - 0.46);
    let h = Math.min(0.5, rise * 2.6) + smoothstep(1.1, 1.9, d) * 1.3;
    const step = 0.26;
    const q = h / step;
    h = step * (Math.floor(q) + smoothstep(0.62, 1, q - Math.floor(q)));
    h += smoothstep(0.4, 1.2, h) * 0.14 * fbm(x * 0.9, z * 0.9, 5);
    const r = Math.hypot(x, z);
    h += smoothstep(8, 15, r) * 3.5 * (0.6 + 0.4 * fbm(x * 0.15, z * 0.15, 9));
    return carveWater(h, x, z, level.scene.water);
  };
}

/**
 * Mission 2-1 · Canyon Passage — a narrow switchback road cut between
 * terraced orange cliffs, a plank bridge over a creek, cacti and mining
 * gear on the ledges, warning signs at every bend.
 */
export default function CanyonPassage({ level, quality }: EnvironmentProps) {
  const mask = useMemo(() => courseMask(level), [level]);
  const height = useMemo(() => canyonHeight(level), [level]);
  const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(PALETTE, 17), size: TERRAIN_SIZE }), [height]);

  const batch = useMemo(() => {
    const b = new PropBatch();
    const rnd = seededRandom(404);
    const y = groundAt(height);
    const k = DENSITY[quality];
    const path = level.scene.path;
    // Warning signs on the ledge at each switchback.
    for (let i = 1; i + 1 < path.length; i++) {
      const p = path[i]!;
      warningSign(b, p.x + 0.62, y(p.x + 0.62, p.z + 0.62), p.z + 0.62, 0.6);
    }
    // Mining gear on the upper ledges: derrick, pipe run, barrels, crates.
    const dx = -1.7;
    const dz = -0.7;
    const dy = y(dx, dz);
    for (const [ox, oz] of [
      [-0.15, -0.15],
      [0.15, -0.15],
      [0, 0.15],
    ] as const)
      pipe(b, [dx + ox, dy, dz + oz], [dx, dy + 1.1, dz], 0.025, '#6b7280');
    beaconMast(b, dx, dy + 1.05, dz, 0.2, 'glowRed');
    pipe(b, [dx + 0.3, dy + 0.12, dz], [dx + 1.2, y(dx + 1.2, dz - 0.9) + 0.12, dz - 0.9], 0.03, '#9ca3af');
    for (let i = 0; i < 4; i++) barrel(b, 1.2 + i * 0.22, y(1.2 + i * 0.22, 1.25), 1.25, 1, i % 2 ? '#dc2626' : '#f59e0b');
    crate(b, 1.4, y(1.4, 1.6), 1.6, 0.2, 0.3);
    crate(b, 1.65, y(1.65, 1.6), 1.6, 0.16, -0.2);
    // Cacti and boulders on the ledges (never on the road).
    for (const p of scatter(rnd, Math.round(90 * k), 7, (x, z) => mask.pathDist(x, z) > 0.7 && mask.waterDist(x, z) > 0.2)) {
      const gy = y(p.x, p.z);
      if (rnd() < 0.45) cactus(b, p.x, gy, p.z, 0.6 + rnd() * 0.6, rnd);
      else rock(b, p.x, gy, p.z, 0.12 + rnd() * 0.25, rnd, rnd() < 0.5 ? '#c26a3d' : '#b0603a');
    }
    // Rubble at the foot of the cliffs.
    for (const p of scatter(rnd, Math.round(40 * k), 3, (x, z) => mask.pathDist(x, z) > 0.46 && mask.pathDist(x, z) < 0.62 && mask.waterDist(x, z) > 0.2)) rock(b, p.x, y(p.x, p.z), p.z, 0.05 + rnd() * 0.06, rnd, '#9c4f2c');
    return b;
  }, [level, quality, mask, height]);

  return (
    <>
      <Terrain field={field} quality={quality} />
      <Road path={level.scene.path} width={level.scene.pathWidth} style={ROAD} />
      <Water water={level.scene.water ?? []} style={WATER} />
      <BatchMesh batch={batch} />
    </>
  );
}
