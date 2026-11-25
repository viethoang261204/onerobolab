import { entityId, mapId, type MapDefinition, type MapEntity, type Vec2 } from '@robolab/shared';
import { PathBuilder } from './path-builder.ts';

const SIZE = { x: 7, z: 5 } as const;
const HX = SIZE.x / 2;
const HZ = SIZE.z / 2;
const BARRIER_HEIGHT = 0.08;
const BARRIER_THICKNESS = 0.05;
const LINE_WIDTH = 0.05;
const START = { x: -2.8, z: 1.8, heading: 0 } as const;

const barrier = (id: string, from: Vec2, to: Vec2): MapEntity => ({
  id: entityId(id),
  type: 'wall',
  from,
  to,
  height: BARRIER_HEIGHT,
  thickness: BARRIER_THICKNESS,
});

const cone = (id: string, x: number, z: number): MapEntity => ({
  id: entityId(id),
  type: 'obstacle',
  position: { x, z },
  radius: 0.045,
  height: 0.11,
});

const crate = (id: string, x: number, z: number, rotation: number): MapEntity => ({
  id: entityId(id),
  type: 'box',
  position: { x, z },
  size: { x: 0.12, y: 0.12, z: 0.12 },
  rotation,
  dynamic: true,
});

/** Main path: straight → left curve → straight (through the intersection) → right curve → straight to the supply area. */
const mainPath = new PathBuilder(START)
  .straight(2)
  .arc(0.6, Math.PI / 2)
  .straight(1.8)
  .arc(0.6, -Math.PI / 2)
  .straight(2.2);

/**
 * "Rescue the Supplies" — mission 1 course. 7 × 5 m platform with a curved
 * line track, a crossing branch (intersection) leading to a red target zone
 * and a blue marker, three checkpoints, cones, and supply crates at the goal.
 * Gaps in the north and east barriers open onto the bridge and ramp.
 */
export const RESCUE_SUPPLIES: MapDefinition = {
  id: mapId('rescue-supplies'),
  name: 'Rescue the Supplies',
  schemaVersion: 1,
  size: SIZE,
  gridSize: 0.5,
  floorColor: 'white',
  start: START,
  finish: { shape: 'rect', center: { x: 2.95, z: -1.2 }, size: { x: 0.8, z: 0.8 }, rotation: 0 },
  entities: [
    // Perimeter barriers (gaps: north for the bridge, east for the ramp).
    barrier('barrier-s', { x: -HX, z: HZ }, { x: HX, z: HZ }),
    barrier('barrier-w', { x: -HX, z: -HZ }, { x: -HX, z: HZ }),
    barrier('barrier-n1', { x: -HX, z: -HZ }, { x: -1.9, z: -HZ }),
    barrier('barrier-n2', { x: -1.1, z: -HZ }, { x: HX, z: -HZ }),
    barrier('barrier-e1', { x: HX, z: -HZ }, { x: HX, z: -1.75 }),
    barrier('barrier-e2', { x: HX, z: -0.65 }, { x: HX, z: HZ }),

    { id: entityId('track-main'), type: 'line', points: mainPath.points(), width: LINE_WIDTH, closed: false },
    {
      id: entityId('track-cross'),
      type: 'line',
      points: [
        { x: -2.05, z: 0.3 },
        { x: 1.75, z: 0.3 },
      ],
      width: LINE_WIDTH,
      closed: false,
    },

    {
      id: entityId('zone-target'),
      type: 'colorZone',
      area: { shape: 'rect', center: { x: -2.4, z: 0.3 }, size: { x: 0.6, z: 0.6 }, rotation: 0 },
      color: 'red',
    },
    {
      id: entityId('zone-marker'),
      type: 'colorZone',
      area: { shape: 'circle', center: { x: 2.05, z: 0.3 }, radius: 0.26 },
      color: 'blue',
    },

    { id: entityId('cp-1'), type: 'checkpoint', area: { shape: 'circle', center: { x: -1.6, z: 1.8 }, radius: 0.22 }, order: 1 },
    { id: entityId('cp-2'), type: 'checkpoint', area: { shape: 'circle', center: { x: -0.2, z: -0.25 }, radius: 0.22 }, order: 2 },
    { id: entityId('cp-3'), type: 'checkpoint', area: { shape: 'circle', center: { x: 1.5, z: -1.2 }, radius: 0.22 }, order: 3 },

    cone('cone-1', -1.05, 1.4),
    cone('cone-2', 0.3, 0.8),
    cone('cone-3', 0.95, -0.75),
    cone('cone-4', 2.2, -1.65),
    cone('cone-5', -0.65, -0.45),

    { id: entityId('block-1'), type: 'box', position: { x: 1.0, z: 0.85 }, size: { x: 0.3, y: 0.18, z: 0.3 }, rotation: 0.2, dynamic: false },
    { id: entityId('block-2'), type: 'box', position: { x: -1.5, z: -1.4 }, size: { x: 0.4, y: 0.14, z: 0.25 }, rotation: -0.15, dynamic: false },

    crate('supply-1', 3.05, -1.4, 0.2),
    crate('supply-2', 3.1, -1.05, -0.3),
    crate('supply-3', 2.85, -1.0, 0.6),
  ],
};
