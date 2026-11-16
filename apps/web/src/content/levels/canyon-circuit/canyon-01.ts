import { checkpoint, corridorWalls, goalArea, levelMap, traceRoute } from '../../environments/level-map';
import { standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';

const START = { x: -1.7, z: 1.1, heading: 0 };
/** Two identical switchback steps down the canyon. */
const route = traceRoute(START, [1, 'L', 1, 'R', 1, 'L', 1, 'R']);

const map = levelMap({
  id: 'canyon-01',
  name: 'Canyon Passage',
  size: { x: 5, z: 4 },
  start: START,
  finish: goalArea(route.end.x, route.end.z, 0.5),
  entities: [checkpoint(1, -0.7, 1.1), checkpoint(2, 0.3, 0.1), ...corridorWalls('cliff', route.points, 0.4, { extendStart: 0.3, extendEnd: 0.45, capEnd: true })],
});

export const CANYON_01: LevelDefinition = {
  id: 'canyon-01',
  world: 'canyon-circuit',
  number: 1,
  title: 'Staircase',
  description: 'A narrow switchback road down the canyon — the same step, again and again.',
  difficulty: 2,
  map,
  environmentId: 'canyon-passage',
  scene: {
    path: [{ x: -2.0, z: 1.1 }, ...route.points.slice(1), { x: 0.3, z: -1.35 }],
    pathWidth: 0.68,
    bridges: [{ from: { x: -0.45, z: 0.1 }, to: { x: 0.05, z: 0.1 }, width: 0.76, style: 'wood' }],
    water: [{ points: [{ x: -0.3, z: 2.4 }, { x: -0.2, z: 0.1 }, { x: -0.35, z: -2.4 }], width: 0.34, depth: 0.5 }],
  },
  mission: standardMission('canyon-01', map, { title: 'Staircase', description: 'Follow the switchbacks down to the canyon exit.', checkpointLabels: ['First switchback', 'Second switchback'], goalLabel: 'Reach the canyon exit' }),
  allowedBlocks: ['event.start', 'motion.forward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop', 'control.repeat'],
  intro: ['Find the step pattern: forward, turn, forward, turn', 'Put one step inside a “repeat” block', 'Repeat it to reach the canyon exit'],
  hints: ['Each step is 100 cm forward and 100 cm to the side.', 'One step = forward 100 → left 90 → forward 100 → right 90.', 'Put that step inside “repeat 2 times”.'],
  stars: { parBlocks: 5, parSeconds: 32 },
  rewards: { xp: 120 },
};
