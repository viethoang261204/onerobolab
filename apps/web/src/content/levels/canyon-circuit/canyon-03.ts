import { checkpoint, corridorWalls, goalArea, levelMap, traceRoute } from '../../environments/level-map';
import { standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';

const START = { x: -2.6, z: -0.5, heading: 0 };
const route = traceRoute(START, [3.8, 'R', 1.2]);

const map = levelMap({
  id: 'canyon-03',
  name: 'Canyon Bridge',
  size: { x: 6.4, z: 3.6 },
  start: START,
  finish: goalArea(route.end.x, route.end.z),
  entities: [checkpoint(1, -0.2, -0.5, 0.24), ...corridorWalls('rail', route.points, 0.42, { extendStart: 0.3, extendEnd: 0.5, capEnd: true, height: 0.16 })],
});

export const CANYON_03: LevelDefinition = {
  id: 'canyon-03',
  world: 'canyon-circuit',
  number: 3,
  title: 'Bridge Crossing',
  description: 'Guide your robot across the suspension bridge over the canyon river.',
  difficulty: 2,
  map,
  environmentId: 'canyon-bridge',
  scene: {
    path: [{ x: -2.9, z: -0.5 }, { x: 1.2, z: -0.5 }, { x: 1.2, z: 1.2 }],
    pathWidth: 0.76,
    bridges: [{ from: { x: -1.5, z: -0.5 }, to: { x: 1.1, z: -0.5 }, width: 0.84, style: 'steel' }],
    water: [{ points: [{ x: -0.1, z: -4 }, { x: -0.35, z: -0.5 }, { x: -0.1, z: 1.2 }, { x: -0.3, z: 4 }], width: 2.0, depth: 2.2 }],
  },
  mission: standardMission('canyon-03', map, { title: 'Bridge Crossing', description: 'Cross the bridge and reach the landing platform.', checkpointLabels: ['Cross the bridge'], goalLabel: 'Reach the landing platform' }),
  allowedBlocks: ['event.start', 'motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop', 'control.repeat'],
  intro: ['Drive straight across the bridge', 'Turn right on the far cliff', 'Park on the landing platform'],
  hints: ['The bridge is dead straight — one long forward move crosses it.', 'The corner on the far side is 380 cm from the start.', 'Try: forward 380 → right 90 → forward 120.'],
  stars: { parBlocks: 3, parSeconds: 25 },
  rewards: { xp: 150 },
};
