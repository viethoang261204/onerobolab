import { checkpoint, corridorWalls, levelMap, traceRoute, wall } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';

/*
 * Mission 1-1 · First Delivery — the robot has just been switched on at
 * Starter Base. Carry a box of spare parts to the Supply Station: drive the
 * paved lane, turn at the loading gate, and STOP on the delivery pad.
 *
 * Teaches: a robot only follows the instructions we give it (sequence,
 * forward, turn, stop). No sensors.
 */

const START = { x: -2.4, z: 0.9, heading: 0 };
/** 3 grid steps (1.8 m) east to the loading corner, then 2 grid steps (1.2 m) north (−z) to the pad. */
const route = traceRoute(START, [1.8, 'L', 1.2]);
const corner = route.points[1]!;
const pad = route.end;
/** The Supply Station's loading door, 0.95 m past the pad: overshoot a lot and you hit it. */
const DOOR_Z = pad.z - 0.95;
/** Delivery zone: a 50 cm square — the robot's centre must stop inside it. */
const PAD = 0.5;

const map = levelMap({
  id: 'starter-01',
  name: 'Starter Courtyard',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: { shape: 'rect', center: { x: pad.x, z: pad.z }, size: { x: PAD, z: PAD }, rotation: 0 },
  entities: [
    checkpoint(1, -1.55, START.z),
    // Kerb hedges along the lane and round the plaza: leaving the route is a crash.
    ...corridorWalls('hedge', [...route.points.slice(0, 2), { x: pad.x, z: DOOR_Z }], 0.42, { extendStart: 0.35, height: 0.18, thickness: 0.14 }),
    wall('dock-station', { x: pad.x - 0.42, z: DOOR_Z }, { x: pad.x + 0.42, z: DOOR_Z }, 0.5, 0.1),
  ],
});

const stars = { parBlocks: 4, parSeconds: 16 };

export const STARTER_01: LevelDefinition = {
  id: 'starter-01',
  world: 'starter-island',
  number: 1,
  title: 'First Delivery',
  description: 'Your robot has just been switched on. Carry the supply box from Starter Base to the Supply Station and stop on the delivery pad.',
  difficulty: 1,
  map,
  environmentId: 'starter-courtyard',
  scene: { path: [{ x: START.x - 0.35, z: START.z }, corner, { x: pad.x, z: DOOR_Z + 0.05 }], pathWidth: 0.72 },
  mission: standardMission('starter-01', map, {
    title: 'First Delivery',
    description: 'Deliver the supply box and stop inside the delivery zone.',
    checkpointLabels: ['Pass the loading gate'],
    goalLabel: 'Stop in the delivery zone',
    stopInFinish: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: ['event.start', 'motion.step', 'motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop'],
  intro: ['Step 3 cells down the lane to the loading gate', 'Turn left towards the Supply Station', 'Step 2 cells onto the delivery pad and stop'],
  hints: [
    'A robot only does what you tell it — one block after another. Each grid step is 60 cm.',
    'In order: step forward 3 → turn left 90° → step forward 2 → stop.',
    'step forward 3 → turn left 90° → step forward ? → stop.',
    'step forward 3 → turn left 90° → step forward 2 → stop.',
  ],
  stars,
  rewards: { xp: 50 },
  briefing: {
    story: 'The storm knocked out Starter Island’s robot network. You have just switched on your first robot at Starter Base. The Supply Station across the courtyard needs a box of spare parts before the repairs can begin.',
    task: 'Carry the supply box to the Supply Station and stop on the delivery pad.',
    objectives: {
      primary: 'Stop inside the delivery zone without hitting anything',
      secondary: `Deliver within ${stars.parSeconds} seconds`,
      optional: `Use ${stars.parBlocks} blocks or fewer`,
    },
    concepts: ['Sequence', 'Grid steps', 'Turn', 'Stop'],
    python: ['robot.step(n)', 'robot.turn_left(90)', 'robot.turn_right(90)', 'robot.stop()'],
    predict: 'Before you code: how far is the corner, which way must the robot turn there, and where exactly should it stop?',
    pseudocode: ['drive forward to the loading gate corner', 'turn left', 'drive forward onto the pad', 'stop'],
    minutes: 5,
    tier: 'easy',
    mechanics: ['cargo'],
  },
};
