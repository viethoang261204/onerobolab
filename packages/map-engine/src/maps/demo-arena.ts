import { entityId, mapId, type MapDefinition, type MapEntity, type Vec2 } from '@robolab/shared';

const SIZE = 8;
const HALF = SIZE / 2;
const WALL_HEIGHT = 0.3;
const WALL_THICKNESS = 0.1;

const wall = (id: string, from: Vec2, to: Vec2): MapEntity => ({
  id: entityId(id),
  type: 'wall',
  from,
  to,
  height: WALL_HEIGHT,
  thickness: WALL_THICKNESS,
});

/** Built-in 8 × 8 m practice arena exercising every MVP entity type. */
export const DEMO_ARENA: MapDefinition = {
  id: mapId('demo-arena'),
  name: 'Practice Arena',
  schemaVersion: 1,
  size: { x: SIZE, z: SIZE },
  gridSize: 0.5,
  floorColor: 'white',
  start: { x: -3, z: 3, heading: 0 },
  finish: { shape: 'rect', center: { x: 3, z: -3 }, size: { x: 1.2, z: 1.2 }, rotation: 0 },
  entities: [
    wall('wall-n', { x: -HALF, z: -HALF }, { x: HALF, z: -HALF }),
    wall('wall-s', { x: -HALF, z: HALF }, { x: HALF, z: HALF }),
    wall('wall-w', { x: -HALF, z: -HALF }, { x: -HALF, z: HALF }),
    wall('wall-e', { x: HALF, z: -HALF }, { x: HALF, z: HALF }),
    wall('wall-inner', { x: -1, z: 1 }, { x: 2.5, z: 1 }),
    {
      id: entityId('box-1'),
      type: 'box',
      position: { x: 1.5, z: -1 },
      size: { x: 0.4, y: 0.4, z: 0.4 },
      rotation: 0.3,
      dynamic: true,
    },
    {
      id: entityId('box-2'),
      type: 'box',
      position: { x: -2, z: -2 },
      size: { x: 0.6, y: 0.3, z: 0.6 },
      rotation: 0,
      dynamic: false,
    },
    { id: entityId('pillar-1'), type: 'obstacle', position: { x: -0.5, z: -0.5 }, radius: 0.2, height: 0.5 },
    { id: entityId('pillar-2'), type: 'obstacle', position: { x: 0.5, z: 2.5 }, radius: 0.15, height: 0.4 },
    {
      id: entityId('cp-1'),
      type: 'checkpoint',
      area: { shape: 'circle', center: { x: 3, z: 2.5 }, radius: 0.4 },
      order: 1,
    },
    {
      id: entityId('cp-2'),
      type: 'checkpoint',
      area: { shape: 'circle', center: { x: 3, z: -0.5 }, radius: 0.4 },
      order: 2,
    },
    {
      id: entityId('track'),
      type: 'line',
      points: [
        { x: -3, z: 3 },
        { x: 3, z: 3 },
        { x: 3, z: -3 },
      ],
      width: 0.04,
      closed: false,
    },
    {
      id: entityId('zone-red'),
      type: 'colorZone',
      area: { shape: 'rect', center: { x: -3, z: -0.5 }, size: { x: 1, z: 1 }, rotation: 0 },
      color: 'red',
    },
    {
      id: entityId('zone-blue'),
      type: 'colorZone',
      area: { shape: 'circle', center: { x: 0.5, z: -3 }, radius: 0.5 },
      color: 'blue',
    },
  ],
};
