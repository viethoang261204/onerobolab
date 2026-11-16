import { useMemo } from 'react';
import { seededRandom } from '../../environment/geometry';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { building, container, gateFrame, lamp, pine, pipe, radarDish, rock, scatter, sign, tank } from '../props/builders';
import { EnergyField, WarningBeacon } from '../scene/Animated';
import { layeredColor, type TerrainField } from '../terrain/fields';
import { Road } from '../terrain/Road';
import { Terrain } from '../terrain/Terrain';
import { DENSITY, type EnvironmentProps } from '../types';
import { courseMask, groundAt, landscape, TERRAIN_SIZE } from './common';

const PALETTE = { floor: '#f2f7fc', floor2: '#e3edf7', low: '#9fb4c9', mid: '#e8f1fa', high: '#dfe9f4', cliff: '#8ea3bc', peak: '#ffffff', peakAt: 2.6, highAt: 2.2 };
const ROAD = { surface: '#cfdbe8', edge: '#a9bdd2', roughness: 0.55 };

/**
 * Mission 3-1 · Frost Depot — a frozen supply route through a snowfield:
 * radar station, heated pipeline on stilts, fuel tanks and containers, an
 * energy gate, and the heated depot; snowy pines and peaks, falling snow.
 */
export default function FrostDepot({ level, quality }: EnvironmentProps) {
  const mask = useMemo(() => courseMask(level), [level]);
  const height = useMemo(() => landscape(level, { flat: 0.7, hills: 1.8, horizon: 8, seed: 61 }), [level]);
  const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(PALETTE, 29), size: TERRAIN_SIZE }), [height]);
  const cps = level.map.entities.filter((e) => e.type === 'checkpoint').map((e) => (e.type === 'checkpoint' ? e.area.center : { x: 0, z: 0 }));
  const gate = cps[2] ?? { x: 1.2, z: -1.6 };
  const goal = level.map.finish.center;

  const batch = useMemo(() => {
    const b = new PropBatch();
    const rnd = seededRandom(707);
    const y = groundAt(height);
    const k = DENSITY[quality];
    const radar = cps[0] ?? { x: -1.7, z: 1.4 };
    // Radar station beside checkpoint 1.
    radarDish(b, radar.x, 0, radar.z - 0.95, 0.4, 1.1);
    building(b, radar.x - 0.8, 0, radar.z - 0.95, 0.7, 0.45, 0.5, 0, '#e2e8f0', 'glowCyan');
    // Heated pipeline on stilts along the long leg (outside the ice wall).
    const px = -1.15;
    for (let z = 0.6; z >= -2.0; z -= 0.52) b.add('boxFloor', 'metalDark', { p: [px, 0, z], s: [0.04, 0.28, 0.04] });
    pipe(b, [px, 0.3, 0.7], [px, 0.3, -2.1], 0.05, '#e5e7eb');
    pipe(b, [px - 0.14, 0.3, 0.7], [px - 0.14, 0.3, -2.1], 0.035, '#fb923c');
    // Fuel tanks + containers.
    tank(b, 0.7, 0, 0.9, 0.28, 0.6, '#f1f5f9');
    tank(b, 1.35, 0, 0.9, 0.22, 0.5, '#e2e8f0');
    container(b, 2.2, 0, 0.3, 0.1, '#dc2626', 0.9);
    container(b, 2.35, 0, 0.85, -0.05, '#2563eb', 0.9);
    // Energy gate at checkpoint 3.
    gateFrame(b, gate.x, 0, gate.z, 0, 1.3, 0.8, 'glowCyan');
    // Heated depot behind the goal.
    building(b, goal.x + 0.2, 0, goal.z + 1.25, 1.4, 0.75, 0.8, Math.PI, '#f8fafc', 'glowWarm');
    b.add('box', 'glowWarm', { p: [goal.x, 0.006, goal.z], s: [0.8, 0.003, 0.8] }, false);
    for (const [x, z] of [
      [-2.6, 0.7],
      [0.2, 1.9],
      [0.25, -0.9],
      [2.0, -0.9],
    ] as const)
      lamp(b, x, 0, z, 0);
    sign(b, -2.9, 0, 0.75, 0, '#0ea5e9');
    // Snowman by the start.
    b.add('sphere', 'tint', { p: [-2.4, 0.09, 2.05], s: 0.18, color: '#ffffff' });
    b.add('sphere', 'tint', { p: [-2.4, 0.24, 2.05], s: 0.12, color: '#ffffff' });
    b.add('coneFloor', 'tint', { p: [-2.4, 0.24, 2.11], r: [Math.PI / 2, 0, 0], s: [0.02, 0.06, 0.02], color: '#f97316' }, false);
    // Snowy pines and rocks in the snowfield and on the hills.
    for (const p of scatter(rnd, Math.round(150 * k), 13, (x, z) => mask.free(x, z, 0.75) && !(Math.abs(x) < 3.2 && Math.abs(z) < 2.1) && mask.clearView(x, z))) {
      const gy = y(p.x, p.z);
      if (rnd() < 0.8) pine(b, p.x, gy, p.z, 0.9 + rnd() * 1.1, rnd, true);
      else rock(b, p.x, gy, p.z, 0.2 + rnd() * 0.3, rnd, '#9fb0c6');
    }
    // Ice crystals.
    for (const p of scatter(rnd, Math.round(14 * k), 3.4, (x, z) => mask.free(x, z, 0.75) && mask.inBounds(x, z))) b.add('octa', 'ice', { p: [p.x, 0.12, p.z], r: [rnd() * 0.3, rnd() * 6, rnd() * 0.3], s: [0.1, 0.28 + rnd() * 0.2, 0.1] });
    return b;
  }, [quality, mask, height, cps, gate.x, gate.z, goal.x, goal.z]);

  return (
    <>
      <Terrain field={field} quality={quality} />
      <Road path={level.scene.path} width={level.scene.pathWidth} style={ROAD} />
      <BatchMesh batch={batch} />
      <EnergyField x={gate.x} z={gate.z} yaw={0} width={1.2} height={0.74} color="#67e8f9" />
      <WarningBeacon x={cps[0]?.x ?? -1.7} y={1.3} z={(cps[0]?.z ?? 1.4) - 0.95} color="#f43f5e" />
    </>
  );
}
