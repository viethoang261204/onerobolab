import { useMemo } from 'react';
import { seededRandom } from '../../environment/geometry';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { barrel, cactus, container, crate, gateFrame, rock, scatter, shelfRack, sign } from '../props/builders';
import { Conveyor, EnergyField, WarningBeacon } from '../scene/Animated';
import { fbm, layeredColor, outsideRect, smoothstep, type TerrainField } from '../terrain/fields';
import { Terrain } from '../terrain/Terrain';
import { DENSITY, type EnvironmentProps } from '../types';
import { courseMask, groundAt, TERRAIN_SIZE } from './common';

const PALETTE = { floor: '#dcae78', floor2: '#d49f69', low: '#8a5a38', mid: '#d9955a', high: '#e7ab6d', cliff: '#b8582f', strata: '#e7b27a', highAt: 2.2 };
/** Building footprint (half sizes). */
const HALL = { x: 2.9, z: 2.1 } as const;
const WALL_H = 1.25;

/**
 * Mission 2-2 · Canyon Warehouse — a cut-away robotics warehouse in the
 * desert: rack aisle, scanner gate, conveyor with moving crates, loading
 * dock door with warning beacons, roof trusses, hanging lamps; mesas outside.
 */
export default function CanyonWarehouse({ level, quality }: EnvironmentProps) {
  const mask = useMemo(() => courseMask(level), [level]);
  const height = useMemo(
    () => (x: number, z: number) => {
      const out = outsideRect(x, z, HALL.x + 0.6, HALL.z + 0.6);
      const dunes = smoothstep(0, 3, out) * 0.6 * (0.5 + 0.5 * fbm(x * 0.3, z * 0.3, 3));
      const mesas = smoothstep(8, 13, Math.hypot(x, z)) * 4 * smoothstep(-0.1, 0.35, fbm(x * 0.12, z * 0.12, 8));
      return dunes + mesas;
    },
    [],
  );
  const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(PALETTE, 21), size: TERRAIN_SIZE }), [height]);
  const cp = level.map.entities.find((e) => e.type === 'checkpoint');
  const gateX = cp?.type === 'checkpoint' ? cp.area.center.x : 0;

  const batch = useMemo(() => {
    const b = new PropBatch();
    const rnd = seededRandom(505);
    const y = groundAt(height);
    const k = DENSITY[quality];
    // Floor slab with painted lane lines and a hatched loading strip.
    b.add('boxFloor', 'concrete', { p: [0, -0.02, 0], s: [HALL.x * 2, 0.024, HALL.z * 2] });
    for (const z of [-0.33, 0.33]) b.add('box', 'tint', { p: [0, 0.006, z], s: [4.4, 0.002, 0.035], color: '#facc15' }, false);
    const f = level.map.finish;
    if (f.shape === 'rect') for (let i = -3; i <= 3; i++) b.add('box', 'hazard', { p: [f.center.x, 0.006, f.center.z + i * 0.1], r: 0.6, s: [f.size.x, 0.002, 0.03] }, false);
    // Hall walls: tall at the back and right, low at the front and left (cut-away for the camera).
    const wall = (x: number, z: number, sx: number, sz: number, h: number) => b.add('boxFloor', 'tint', { p: [x, 0, z], s: [sx, h, sz], color: '#e5ddd2' });
    wall(0, -HALL.z, HALL.x * 2, 0.12, WALL_H);
    wall(HALL.x, 0, 0.12, HALL.z * 2, WALL_H);
    wall(0, HALL.z, HALL.x * 2, 0.12, 0.24);
    wall(-HALL.x, 0, 0.12, HALL.z * 2, 0.24);
    for (let x = -2.4; x <= 2.4; x += 1.2) b.add('box', 'glass', { p: [x, WALL_H * 0.7, -HALL.z + 0.07], s: [0.8, 0.28, 0.02] }, false);
    // Roof trusses + skylight strips.
    // Roof trusses only at the hall ends + along the back (cut-away roof keeps the aisle visible).
    for (const x of [-HALL.x + 0.06, HALL.x - 0.06]) b.add('box', 'metalDark', { p: [x, WALL_H + 0.05, 0], s: [0.06, 0.08, HALL.z * 2] });
    b.add('box', 'metalDark', { p: [0, WALL_H + 0.05, -HALL.z + 0.06], s: [HALL.x * 2, 0.08, 0.06] });
    // Hanging lamps over the aisle.
    for (let x = -1.8; x <= 1.6; x += 1.1) {
      b.add('cylinder', 'metalDark', { p: [x, WALL_H - 0.05, -0.62], s: [0.008, 0.2, 0.008] }, false);
      b.add('coneFloor', 'metalDark', { p: [x, WALL_H - 0.12, -0.62], r: [Math.PI, 0, 0], s: [0.16, 0.08, 0.16] }, false);
      b.add('sphere', 'glowWarm', { p: [x, WALL_H - 0.2, -0.62], s: 0.06 }, false);
    }
    // Extra rack rows beside the aisle and pallets of goods.
    shelfRack(b, 0.2, -1.35, 3.6, 0, rnd, 0.34, 0.8);
    for (let i = 0; i < 6; i++) crate(b, -2.5 + rnd() * 0.5, 0, -1.9 + rnd() * 0.4, 0.14 + rnd() * 0.08, rnd());
    for (let i = 0; i < 4; i++) barrel(b, 2.55, 0, -1.8 + i * 0.26, 1, i % 2 ? '#2563eb' : '#16a34a');
    // Scanner gate frame over the aisle at the checkpoint.
    gateFrame(b, gateX, 0, 0, 0, 1.46, 1.0, 'glowPurple');
    sign(b, -2.4, 0, 0.85, Math.PI / 2, '#f59e0b');
    // Outside: trucks bay containers, cacti, rocks.
    container(b, 3.6, y(3.6, 0.9), 0.9, Math.PI / 2, '#2563eb');
    container(b, 3.7, y(3.7, -0.9), -0.9, Math.PI / 2, '#d9573b');
    container(b, -3.8, y(-3.8, -1.2), -1.2, 0.1, '#16a34a');
    for (const p of scatter(rnd, Math.round(70 * k), 12, (x, z) => outsideRect(x, z, HALL.x + 0.5, HALL.z + 0.5) > 0.3)) {
      const gy = y(p.x, p.z);
      if (rnd() < 0.45) cactus(b, p.x, gy, p.z, 0.7 + rnd() * 0.6, rnd);
      else rock(b, p.x, gy, p.z, 0.15 + rnd() * 0.3, rnd, '#c26a3d');
    }
    void mask;
    return b;
  }, [level, quality, mask, height, gateX]);

  return (
    <>
      <Terrain field={field} quality={quality} />
      <BatchMesh batch={batch} />
      <EnergyField x={gateX} z={0} yaw={0} width={1.3} height={0.92} color="#a78bfa" />
      <Conveyor x={-0.2} z={1.9} yaw={0} length={4.2} />
      <WarningBeacon x={2.0} y={0.8} z={0.72} />
      <WarningBeacon x={2.0} y={0.8} z={-0.72} />
    </>
  );
}
