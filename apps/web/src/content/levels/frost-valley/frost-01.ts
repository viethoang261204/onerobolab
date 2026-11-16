import { checkpoint, corridorWalls, goalArea, levelMap, obstacle, supplyCrate, traceRoute } from '../../environments/level-map';
import { standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';

const START = { x: -3.0, z: 1.4, heading: 0 };
const route = traceRoute(START, [2.6, 'L', 3.0, 'R', 3.2]);

const map = levelMap({
  id: 'frost-01',
  name: 'Frost Depot',
  size: { x: 7, z: 4.6 },
  start: START,
  finish: goalArea(route.end.x, route.end.z, 0.7),
  entities: [
    checkpoint(1, -1.7, 1.4),
    checkpoint(2, -0.4, -0.1),
    checkpoint(3, 1.2, -1.6),
    ...corridorWalls('ice', route.points, 0.55, { extendStart: 0.3, extendEnd: 0.45, capEnd: true, height: 0.16, thickness: 0.1 }),
    // Marker cones along the route edges.
    obstacle('cone-1', -2.2, 1.72),
    obstacle('cone-2', -1.1, 1.08),
    obstacle('cone-3', -0.72, 0.6),
    obstacle('cone-4', -0.08, -0.7),
    obstacle('cone-5', 0.5, -1.92),
    obstacle('cone-6', 1.9, -1.28),
    supplyCrate('supply-1', 3.02, -1.86, 0.2),
    supplyCrate('supply-2', 3.06, -1.36, -0.3),
  ],
});

export const FROST_01: LevelDefinition = {
  id: 'frost-01',
  world: 'frost-valley',
  number: 1,
  title: 'Rescue the Supplies',
  description: 'A frozen supply route: three checkpoints, marker cones, and the heated depot.',
  difficulty: 3,
  map,
  environmentId: 'frost-depot',
  scene: { path: [{ x: -3.3, z: 1.4 }, { x: -0.4, z: 1.4 }, { x: -0.4, z: -1.6 }, { x: 3.25, z: -1.6 }], pathWidth: 0.9 },
  mission: standardMission('frost-01', map, { title: 'Rescue the Supplies', description: 'Pass all three checkpoints and deliver to the depot.', checkpointLabels: ['Radar station', 'Pipeline gate', 'Energy gate'], goalLabel: 'Deliver to the heated depot' }),
  allowedBlocks: 'all',
  intro: ['Pass the three checkpoints in order', 'Avoid every cone and ice barrier', 'Deliver to the heated depot'],
  hints: ['The route goes straight, left, straight, right, straight.', 'Drive into each corner before you turn.', 'Try: forward 260 → left 90 → forward 300 → right 90 → forward 320.'],
  stars: { parBlocks: 5, parSeconds: 40 },
  rewards: { xp: 200 },
};
