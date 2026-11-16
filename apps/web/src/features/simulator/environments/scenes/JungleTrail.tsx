import { useMemo } from 'react';
import { seededRandom } from '../../environment/geometry';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { bush, jungleTree, LEAF, pillar, rock, scatter, temple, tuft } from '../props/builders';
import { Waterfall } from '../scene/Animated';
import { layeredColor, smoothstep, type TerrainField } from '../terrain/fields';
import { Road } from '../terrain/Road';
import { Terrain } from '../terrain/Terrain';
import { Water } from '../terrain/Water';
import { DENSITY, type EnvironmentProps } from '../types';
import { courseMask, groundAt, landscape, TERRAIN_SIZE } from './common';

const PALETTE = { floor: '#4f8f3a', floor2: '#5f9d44', low: '#4a3b2a', mid: '#3f7f34', high: '#35702e', cliff: '#6b6f5f', highAt: 2.2 };
const ROAD = { surface: '#8d6b45', edge: '#5f4a30', roughness: 1 };
const WATER = { deep: '#1d6b6a', shallow: '#4fc1a9' };

/**
 * Mission 4-1 · Jungle Trail — a trail through dense stylised forest: two
 * streams with a log bridge and a rope bridge, a waterfall off a mossy
 * cliff, ferns and boulders, and the stepped temple ruin at the end.
 */
export default function JungleTrail({ level, quality }: EnvironmentProps) {
  const mask = useMemo(() => courseMask(level), [level]);
  const height = useMemo(
    () =>
      landscape(level, {
        flat: 0.6,
        hills: 1.8,
        horizon: 5,
        seed: 71,
        // Mossy cliff feeding the waterfall behind the second stream.
        extra: (x, z) => smoothstep(2.1, 2.7, z) * smoothstep(1.6, 0.6, Math.abs(x - 0.5)) * 1.3,
      }),
    [level],
  );
  const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(PALETTE, 33), size: TERRAIN_SIZE }), [height]);
  const goal = level.map.finish.center;

  const batch = useMemo(() => {
    const b = new PropBatch();
    const rnd = seededRandom(808);
    const y = groundAt(height);
    const k = DENSITY[quality];
    // Temple ruin behind the goal, stone arch over the goal.
    temple(b, goal.x + 1.35, 0, goal.z, 0, 0.75);
    for (const s of [-1, 1]) pillar(b, goal.x + 0.35, 0, goal.z + s * 0.45, 0.55, rnd);
    b.add('box', 'tintFlat', { p: [goal.x + 0.35, 0.68, goal.z], s: [0.18, 0.1, 1.05], color: '#a3ab9c' });
    // Broken pillars along the last leg.
    for (const [x, z, h] of [
      [-0.2, 1.62, 0.35],
      [1.0, 0.45, 0.25],
      [-1.4, 0.4, 0.45],
    ] as const)
      pillar(b, x, 0, z, h, rnd);
    // Dense forest everywhere off the trail and streams.
    for (const p of scatter(rnd, Math.round(170 * k), 12, (x, z) => mask.free(x, z, 0.6) && mask.waterDist(x, z) > 0.2 && mask.clearView(x, z))) {
      const gy = y(p.x, p.z);
      const r = rnd();
      if (r < 0.55) jungleTree(b, p.x, gy, p.z, 0.8 + rnd() * 0.9, rnd);
      else if (r < 0.85) bush(b, p.x, gy, p.z, 0.8 + rnd() * 0.6, rnd, LEAF.jungle);
      else rock(b, p.x, gy, p.z, 0.15 + rnd() * 0.25, rnd, '#7b8575');
    }
    // Ferns and tufts close to the trail.
    for (const p of scatter(rnd, Math.round(90 * k), 3.2, (x, z) => mask.free(x, z, 0.2) && mask.waterDist(x, z) > 0.1)) tuft(b, p.x, y(p.x, p.z), p.z, 1.2 + rnd() * 0.6, rnd, rnd() < 0.5 ? '#3f8a3a' : '#2f7a33');
    return b;
  }, [quality, mask, height, goal.x, goal.z]);

  return (
    <>
      <Terrain field={field} quality={quality} />
      <Road path={level.scene.path} width={level.scene.pathWidth} style={ROAD} />
      <Water water={level.scene.water ?? []} style={WATER} />
      <BatchMesh batch={batch} />
      <Waterfall x={0.5} y={-0.3} z={2.62} yaw={0} width={0.6} height={1.6} />
    </>
  );
}
