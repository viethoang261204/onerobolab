import { useMemo } from 'react';
import { seededRandom } from '../../environment/geometry';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { beaconMast, cactus, rock, scatter, sign, warningSign } from '../props/builders';
import { WarningBeacon } from '../scene/Animated';
import { layeredColor, smoothstep, type TerrainField } from '../terrain/fields';
import { Road } from '../terrain/Road';
import { Terrain } from '../terrain/Terrain';
import { Water } from '../terrain/Water';
import { DENSITY, type EnvironmentProps } from '../types';
import { courseMask, groundAt, landscape, TERRAIN_SIZE } from './common';

const PALETTE = { floor: '#d69a62', floor2: '#c98a55', low: '#6b4b34', mid: '#cf8250', high: '#e2a063', cliff: '#a9532e', strata: '#e3a36c', highAt: 2.8 };
const ROAD = { surface: '#b98b62', edge: '#8c6444', roughness: 1 };
const WATER = { deep: '#16637a', shallow: '#3fb2c4' };

/** Flat-topped butte bump. */
const butte = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * smoothstep(r + 0.6, r, Math.hypot(x - cx, z - cz));

/**
 * Mission 2-3 · Canyon Bridge — two cliffs split by a deep river gorge with
 * banded rock walls, a steel suspension bridge with towers, cables and
 * warning lights, buttes on the horizon, and a landing platform.
 */
export default function CanyonBridge({ level, quality }: EnvironmentProps) {
  const mask = useMemo(() => courseMask(level), [level]);
  const height = useMemo(
    () =>
      landscape(level, {
        flat: 0.8,
        hills: 1.6,
        horizon: 6,
        seed: 51,
        extra: (x, z) => butte(x, z, -5.5, -4.5, 1.3, 2.6) + butte(x, z, 5.8, 4.2, 1.6, 3.1) + butte(x, z, 6.5, -5.5, 1.1, 2.2),
      }),
    [level],
  );
  const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(PALETTE, 25), size: TERRAIN_SIZE }), [height]);
  const goal = level.map.finish.center;

  const batch = useMemo(() => {
    const b = new PropBatch();
    const rnd = seededRandom(606);
    const y = groundAt(height);
    const k = DENSITY[quality];
    // Landing platform with a beacon.
    b.add('hexFloor', 'concrete', { p: [goal.x, -0.02, goal.z], s: [1.0, 0.03, 1.0] });
    b.add('hexFloor', 'glowAmber', { p: [goal.x, 0.011, goal.z], s: [1.02, 0.004, 1.02] }, false);
    beaconMast(b, goal.x + 0.65, 0, goal.z + 0.4, 0.9, 'glowAmber');
    // Signs at both bridge heads.
    for (const br of level.scene.bridges ?? []) {
      warningSign(b, br.from.x - 0.25, 0, br.from.z - 0.62, 0);
      warningSign(b, br.to.x + 0.25, 0, br.to.z + 0.62, Math.PI);
    }
    sign(b, -2.75, 0, 0.55, 0, '#f59e0b');
    // Desert scatter on both cliffs (away from the gorge rim and the road).
    for (const p of scatter(rnd, Math.round(110 * k), 12, (x, z) => mask.pathDist(x, z) > 0.75 && mask.waterDist(x, z) > 0.45)) {
      const gy = y(p.x, p.z);
      if (rnd() < 0.4) cactus(b, p.x, gy, p.z, 0.6 + rnd() * 0.7, rnd);
      else rock(b, p.x, gy, p.z, 0.12 + rnd() * 0.35, rnd, rnd() < 0.5 ? '#b8643a' : '#9c5230');
    }
    // Boulders in the river bed.
    for (const w of level.scene.water ?? [])
      for (let i = 0; i < 10; i++) {
        const t = rnd();
        const a = w.points[Math.floor(t * (w.points.length - 1))]!;
        rock(b, a.x + (rnd() - 0.5) * w.width * 0.8, -w.depth - 0.1, a.z + (rnd() - 0.5) * 3, 0.15 + rnd() * 0.2, rnd, '#7a4a30');
      }
    return b;
  }, [level, quality, mask, height, goal.x, goal.z]);

  const bridge = level.scene.bridges?.[0];
  return (
    <>
      <Terrain field={field} quality={quality} />
      <Road path={level.scene.path} width={level.scene.pathWidth} style={ROAD} />
      <Water water={level.scene.water ?? []} style={WATER} />
      <BatchMesh batch={batch} />
      {bridge && (
        <>
          <WarningBeacon x={bridge.from.x - 0.1} y={0.2} z={bridge.from.z - 0.6} />
          <WarningBeacon x={bridge.to.x + 0.1} y={0.2} z={bridge.to.z + 0.6} />
        </>
      )}
    </>
  );
}
