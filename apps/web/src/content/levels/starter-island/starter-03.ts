import type { MapEntity, Vec2 } from '@robolab/shared';
import { block, checkpoint, levelMap, obstacle, wall } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';

/*
 * Mission 1-3 · Supply Run — the storm scattered debris over the meadow
 * trail to the riverside clinic. No sensors yet: the student looks at the
 * map and PLANS a route around a crate pile and a boulder, then crosses the
 * creek bridge and stops at the clinic's supply pad.
 *
 * Teaches: planned obstacle avoidance (a detour is just more moves and turns).
 */

const START = { x: -2.4, z: 0.9, heading: 0 };
/** The wide meadow lane (x −2.95 → 0.52, z 0.0 → 1.55); the narrow bridge lane south of it. */
const LANE = { x0: -2.95, x1: 0.52, z0: 0.0, z1: 1.55 };
const BRIDGE_X = 0.0;
const BRIDGE_HALF = 0.42;
const pad: Vec2 = { x: BRIDGE_X, z: -0.9 };
/** The clinic's door, 0.95 m past the pad. */
const DOOR_Z = pad.z - 0.95;

const walls: MapEntity[] = [
  wall('fence-north', { x: LANE.x0, z: LANE.z1 }, { x: LANE.x1, z: LANE.z1 }),
  wall('fence-west', { x: LANE.x0, z: LANE.z0 }, { x: LANE.x0, z: LANE.z1 }),
  wall('fence-east', { x: LANE.x1, z: LANE.z1 }, { x: LANE.x1, z: DOOR_Z }),
  wall('fence-south', { x: LANE.x0, z: LANE.z0 }, { x: BRIDGE_X - BRIDGE_HALF, z: LANE.z0 }),
  wall('fence-bridge', { x: BRIDGE_X - BRIDGE_HALF, z: LANE.z0 }, { x: BRIDGE_X - BRIDGE_HALF, z: DOOR_Z }),
  wall('dock-clinic', { x: BRIDGE_X - BRIDGE_HALF, z: DOOR_Z }, { x: LANE.x1, z: DOOR_Z }, 0.5, 0.1),
];

const map = levelMap({
  id: 'starter-03',
  name: 'Supply Run',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: { shape: 'rect', center: pad, size: { x: 0.5, z: 0.5 }, rotation: 0 },
  entities: [
    checkpoint(1, -1.2, 0.3),
    checkpoint(2, BRIDGE_X, -0.3),
    // Storm debris on the trail (grid-aligned so robot.step(n) sidesteps cleanly).
    block('crate-pile', -1.2, 0.9, 0.5, 0.5, 0.3),
    obstacle('rock-1', -0.3, 0.45, 0.10, 0.18),
    obstacle('rock-2', -2.3, 1.3, 0.12, 0.18),
    ...walls,
  ],
});

const stars = { parBlocks: 12, parSeconds: 32 };

export const STARTER_03: LevelDefinition = {
  id: 'starter-03',
  world: 'starter-island',
  number: 3,
  title: 'Supply Run',
  description: 'Storm debris blocks the trail to the riverside clinic. Plan a route around the crate pile and the boulder, cross the creek bridge and deliver the supplies.',
  difficulty: 2,
  map,
  environmentId: 'starter-creek-bridge',
  scene: {
    path: [{ x: LANE.x0 + 0.05, z: START.z }, { x: BRIDGE_X, z: START.z }, { x: BRIDGE_X, z: DOOR_Z + 0.05 }],
    pathWidth: 0.84,
    bridges: [{ from: { x: BRIDGE_X, z: 0.05 }, to: { x: BRIDGE_X, z: -0.75 }, width: 0.84, style: 'wood' }],
    water: [{ points: [{ x: -3.4, z: -0.3 }, { x: -1.6, z: -0.42 }, { x: BRIDGE_X, z: -0.35 }, { x: 1.4, z: -0.25 }, { x: 3.4, z: -0.4 }], width: 0.56, depth: 0.28 }],
  },
  mission: standardMission('starter-03', map, {
    title: 'Supply Run',
    description: 'Go around the debris, cross the bridge and stop on the clinic’s supply pad.',
    checkpointLabels: ['Get past the crate pile', 'Cross the creek bridge'],
    goalLabel: 'Stop on the clinic’s supply pad',
    stopInFinish: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: ['event.start', 'motion.step', 'motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop'],
  intro: ['Step 1 cell, then sidestep left 1 cell around the crate pile', 'Step 2 cells past the pile, then step back to the main lane', 'Turn onto the bridge and step 3 cells onto the supply pad'],
  hints: [
    'There are no sensors yet, so count the 60 cm grid cells from above: the gap is 1 cell to the left of the crate pile.',
    'step 1 → turn left → step 1 → turn right → step 2 → turn right → step 1 → turn left → step 1 → turn left → step 3 → stop.',
    'step 1 → turn left 90 → step 1 → turn right 90 → step 2 → turn right 90 → step 1 → turn left 90 → step ? → turn left 90 → step ? → stop.',
    'step 1 → turn left 90 → step 1 → turn right 90 → step 2 → turn right 90 → step 1 → turn left 90 → step 1 → turn left 90 → step 3 → stop.',
  ],
  stars,
  rewards: { xp: 100 },
  briefing: {
    story: 'The power is back, but the storm left the meadow trail covered in debris. The riverside clinic across the creek is waiting for its medical supplies — and your robot has no sensors yet. It will only avoid what you plan for.',
    task: 'Plan a route around the debris, cross the creek bridge and stop on the clinic’s supply pad.',
    objectives: {
      primary: 'Deliver the supplies to the clinic pad without touching any debris',
      secondary: `Deliver within ${stars.parSeconds} seconds`,
      optional: `Use ${stars.parBlocks} blocks or fewer`,
    },
    concepts: ['Planned obstacle avoidance', 'Grid detours', 'Route planning', 'Sequence'],
    python: ['robot.step(n)', 'robot.turn_left(90)', 'robot.turn_right(90)', 'robot.stop()'],
    predict: 'Which side of the crate pile is free? After the detour, what is still in the way before the bridge?',
    pseudocode: ['drive up to the crate pile', 'sidestep towards the creek', 'drive past the pile', 'sidestep back to the middle', 'drive to the bridge corner', 'turn towards the creek', 'cross the bridge onto the pad', 'stop'],
    minutes: 8,
    tier: 'medium',
    mechanics: ['cargo'],
  },
};
