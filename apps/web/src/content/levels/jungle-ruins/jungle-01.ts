import { checkpoint, corridorWalls, goalArea, levelMap, obstacle, traceRoute } from '../../environments/level-map';
import { standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';

const START = { x: -2.6, z: -1.2, heading: 0 };
const route = traceRoute(START, [1.8, 'R', 2.2, 'L', 2.4]);

const map = levelMap({
  id: 'jungle-01',
  name: 'Jungle Trail',
  size: { x: 6, z: 4 },
  start: START,
  finish: goalArea(route.end.x, route.end.z),
  entities: [
    checkpoint(1, -1.7, -1.2),
    checkpoint(2, -0.8, -0.1),
    checkpoint(3, 0.4, 1.0),
    ...corridorWalls('log', route.points, 0.42, { extendStart: 0.3, extendEnd: 0.5, capEnd: true }),
    // Half-hidden in the undergrowth at the trail edge.
    obstacle('rock-1', -2.0, -0.92, 0.07, 0.1),
    obstacle('stump-1', 1.15, 1.3, 0.06, 0.1),
  ],
});

export const JUNGLE_01: LevelDefinition = {
  id: 'jungle-01',
  world: 'jungle-ruins',
  number: 1,
  title: 'Forest Checkpoint',
  description: 'Follow the jungle trail over two streams, past three trail markers, to the ruins.',
  difficulty: 3,
  map,
  environmentId: 'jungle-trail',
  scene: {
    path: [{ x: -2.9, z: -1.2 }, { x: -0.8, z: -1.2 }, { x: -0.8, z: 1.0 }, { x: 2.1, z: 1.0 }],
    pathWidth: 0.66,
    bridges: [
      { from: { x: -0.8, z: 0.3 }, to: { x: -0.8, z: -0.5 }, width: 0.8, style: 'log' },
      { from: { x: 0.0, z: 1.0 }, to: { x: 0.8, z: 1.0 }, width: 0.8, style: 'rope' },
    ],
    water: [
      { points: [{ x: -3.4, z: 0.2 }, { x: -0.8, z: -0.1 }, { x: 1.0, z: -0.6 }, { x: 3.4, z: -0.4 }], width: 0.6, depth: 0.3 },
      { points: [{ x: 0.5, z: 2.6 }, { x: 0.4, z: 1.0 }, { x: 0.9, z: 0.0 }, { x: 1.0, z: -0.6 }], width: 0.52, depth: 0.3 },
    ],
  },
  mission: standardMission('jungle-01', map, { title: 'Forest Checkpoint', description: 'Reach every trail marker and the ruins gate.', checkpointLabels: ['Reach the trail marker', 'Cross the log bridge', 'Cross the rope bridge'], goalLabel: 'Reach the ruins gate' }),
  allowedBlocks: ['event.start', 'motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop', 'motion.speed', 'control.repeat'],
  intro: ['Follow the trail to the first marker', 'Cross both bridges', 'Reach the gate of the ruins'],
  hints: ['The trail goes straight, right, straight, left, straight.', 'Watch the rock and the stump at the trail edge — stay in the middle.', 'Try: forward 180 → right 90 → forward 220 → left 90 → forward 240.'],
  stars: { parBlocks: 5, parSeconds: 40 },
  rewards: { xp: 180 },
};
