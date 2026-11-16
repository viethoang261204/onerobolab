import { entityId } from '@robolab/shared';
import { goalArea, levelMap, rect, supplyCrate, wall, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { MOVES } from './kit';

/*
 * Mission 1-4 · Build the Bridge — the footbridge over the meadow stream
 * was washed away. Three bridge blocks lie beside the lane: push each one
 * into the construction zone (counter 0/3), then drive on to the far bank.
 *
 * Teaches: interacting with the world (pushing), planning repeated steps.
 */

const START = { x: -2.4, z: 0.9, heading: 0 };
const LANE_Z = 0.9;
/** Bridge blocks, 1 grid step (60 cm) apart. */
const CRATES = [-1.2, -0.6, 0.0];
const SITE = rect(-0.6, -0.55, 2.2, 0.8);

const map = levelMap({
  id: 'starter-04',
  name: 'Build the Bridge',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: goalArea(1.8, LANE_Z),
  entities: [
    zone('site', 'construction', SITE, { label: 'BRIDGE SITE' }),
    ...CRATES.map((x, i) => supplyCrate(`block-${i + 1}`, x, 0.45)),
    wall('fence-south', { x: -2.9, z: 1.35 }, { x: 2.3, z: 1.35 }),
    wall('fence-west', { x: -2.9, z: -1.15 }, { x: -2.9, z: 1.35 }),
    wall('fence-north', { x: -2.9, z: -1.15 }, { x: 2.3, z: -1.15 }),
    wall('fence-east', { x: 2.3, z: -1.15 }, { x: 2.3, z: 1.35 }),
  ],
});

const stars = { parBlocks: 10, parSeconds: 52 };

export const STARTER_04: LevelDefinition = {
  id: 'starter-04',
  world: 'starter-island',
  number: 4,
  title: 'Build the Bridge',
  description: 'The stream washed the footbridge away. Push all three bridge blocks into the construction zone, then cross to the far bank.',
  difficulty: 2,
  map,
  environmentId: 'starter-meadow-lanes',
  scene: { path: [{ x: -2.7, z: LANE_Z }, { x: 2.0, z: LANE_Z }], pathWidth: 0.7, water: [{ points: [{ x: -3.8, z: -1.75 }, { x: 0, z: -1.6 }, { x: 3.8, z: -1.75 }], width: 0.7, depth: 0.3 }] },
  mission: standardMission('starter-04', map, {
    title: 'Build the Bridge',
    description: 'Push the three bridge blocks into the construction zone and reach the far bank.',
    tasks: [{ id: 'build', type: 'pushToZone', zoneId: entityId('site'), count: 3, label: 'Push 3 blocks into the construction zone' }],
    goalLabel: 'Reach the far bank',
    scoring: scoringFor(stars),
  }),
  allowedBlocks: MOVES,
  intro: ['Drive up beside a bridge block', 'Turn towards the construction zone and push it in', 'Back up, do the next block, then drive to the far bank'],
  hints: [
    'The robot can push a block simply by driving into it. Every block needs the same moves: drive beside it, turn, push, back up, turn back.',
    'drive to block 1 → turn left → push forward → drive backward → turn right → drive to block 2 → … → drive to the far bank.',
    'move forward 120 → turn left 90 → move forward 120 → move backward 120 → turn right 90 → move forward ? → … The blocks are 80 cm apart.',
    'move forward 120 → turn left 90 → move forward 120 → move backward 120 → turn right 90 → move forward 80 → turn left 90 → move forward 120 → move backward 120 → turn right 90 → move forward 80 → turn left 90 → move forward 120 → move backward 120 → turn right 90 → move forward 130.',
  ],
  stars,
  rewards: { xp: 110 },
  briefing: {
    story: 'Power and supplies are flowing again, but the storm washed the footbridge over the meadow stream away. The builders left three bridge blocks beside the lane — your robot has to push them onto the bridge site.',
    task: 'Push all three bridge blocks into the construction zone, then drive to the far bank.',
    objectives: { primary: 'Push 3 blocks into the construction zone and reach the far bank', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Pushing objects', 'Repeated steps', 'Sequence', 'Backing up'],
    python: ['robot.move_forward(cm)', 'robot.move_backward(cm)', 'robot.turn_left(degrees)', 'robot.turn_right(degrees)'],
    predict: 'How far must the robot push so a block ends up inside the zone? Which moves are the same for every block?',
    pseudocode: ['drive beside block 1', 'turn towards the zone, push, back up, turn back', 'drive beside block 2 — same moves', 'drive beside block 3 — same moves', 'drive to the far bank'],
    minutes: 8,
    tier: 'medium',
    mechanics: ['push'],
  },
};
