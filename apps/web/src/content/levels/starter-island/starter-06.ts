import { checkpoint, goalArea, levelMap, obstacle } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { MOVES } from './kit';

/*
 * Mission 1-6 · Rescue Route — three hikers are stranded in the woods and
 * the rescue team must reach them in order of urgency: 1, 2, 3, then back to
 * the ranger station. Hiker 2 sits right on the short way to hiker 1, so
 * the route has to go round — reaching a hiker out of turn fails.
 *
 * Teaches: ordered goals, planning a whole route before coding.
 */

const START = { x: -2.4, z: 0.9, heading: 0 };

const map = levelMap({
  id: 'starter-06',
  name: 'Rescue Route',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: goalArea(1.2, -0.3),
  entities: [
    checkpoint(1, -0.6, -0.3),
    checkpoint(2, -0.6, 0.9),
    checkpoint(3, 1.2, 0.9),
    obstacle('rock-1', 0.3, 0.3, 0.14, 0.18),
    obstacle('rock-2', -1.9, 0.2, 0.12, 0.16),
    obstacle('rock-3', 0.5, -1.2, 0.14, 0.18),
    obstacle('rock-4', -2.3, -1.2, 0.12, 0.16),
    obstacle('stump-1', -0.1, 0.3, 0.08, 0.12),
  ],
});

const stars = { parBlocks: 11, parSeconds: 40 };

export const STARTER_06: LevelDefinition = {
  id: 'starter-06',
  world: 'starter-island',
  number: 6,
  title: 'Rescue Route',
  description: 'Three hikers are stranded in the woods. Reach them strictly in order — 1, 2, 3 — then return to the ranger station. Hiker 2 is on the short way to hiker 1.',
  difficulty: 2,
  map,
  environmentId: 'starter-boulder-woods',
  scene: { path: [{ x: -2.7, z: 0.9 }, { x: -1.2, z: 0.9 }, { x: -1.2, z: -0.3 }, { x: -0.6, z: -0.3 }, { x: -0.6, z: 0.9 }, { x: 1.2, z: 0.9 }, { x: 1.2, z: -0.5 }], pathWidth: 0.55 },
  mission: standardMission('starter-06', map, {
    title: 'Rescue Route',
    description: 'Reach hikers 1, 2 and 3 in order, then the ranger station.',
    checkpointLabels: ['Rescue hiker 1', 'Rescue hiker 2', 'Rescue hiker 3'],
    goalLabel: 'Return to the ranger station',
    orderedCheckpoints: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: MOVES,
  intro: ['Hiker 1 first, then 2, then 3', 'Reaching a hiker out of turn fails the rescue', 'Count the 60 cm grid steps round hiker 2'],
  hints: [
    'Use the top camera. Driving straight east reaches hiker 2 first — that is the wrong order. Go round: north first.',
    'step 2 → turn left → step 2 → turn right → step 1 (hiker 1) → turn right → step 2 (hiker 2) → turn left → step 3 (hiker 3) → turn left → step 2.',
    'step 2 → turn left 90 → step 2 → turn right 90 → step 1 → turn right 90 → step ? → turn left 90 → step ? → turn left 90 → step 2.',
    'step 2 → turn left 90 → step 2 → turn right 90 → step 1 → turn right 90 → step 2 → turn left 90 → step 3 → turn left 90 → step 2.',
  ],
  stars,
  rewards: { xp: 120 },
  briefing: {
    story: 'The storm caught three hikers in the woods. The rescue team ranked them by urgency, and your robot has to reach them in exactly that order before returning to the ranger station.',
    task: 'Reach hiker 1, then hiker 2, then hiker 3, then return to the ranger station.',
    objectives: { primary: 'Rescue the hikers in order 1 → 2 → 3 and return to the station', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Ordered goals', 'Grid route planning', 'Sequence'],
    python: ['robot.step(n)', 'robot.turn_left(90)', 'robot.turn_right(90)'],
    predict: 'Which hiker is on the short way to hiker 1? How can the robot reach hiker 1 without passing hiker 2?',
    pseudocode: ['go north round hiker 2', 'reach hiker 1', 'drive south to hiker 2', 'drive east to hiker 3', 'drive north to the station'],
    minutes: 8,
    tier: 'medium',
    mechanics: [],
  },
};
