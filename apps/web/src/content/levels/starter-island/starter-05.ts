import { corridorWalls, goalArea, levelMap, rect, trafficLight } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { TIMING } from './kit';

/*
 * Mission 1-5 · Traffic Crossing — the island's traffic lights are back on.
 * Two zebra crossings on the way to the depot, each with its own timetable.
 * The robot must never enter a crossing on red: stop at the line, wait the
 * right number of seconds, go.
 *
 * Teaches: timing, `wait`, reading a timetable.
 */

const START = { x: -2.4, z: 0.9, heading: 0 };
const CORNER = { x: 0.6, z: 0.9 };
const GOAL = { x: 0.6, z: -1.5 };

const map = levelMap({
  id: 'starter-05',
  name: 'Traffic Crossing',
  size: { x: 6, z: 4.6 },
  start: START,
  finish: goalArea(GOAL.x, GOAL.z),
  entities: [
    // Light A: 2 grid steps east (-1.2, 0.9). Red 0–8 s, green 8–14 s, yellow 14–15 s.
    trafficLight('light-a', { position: { x: -1.2, z: 0.35 }, facing: Math.PI, crossing: rect(-0.9, 0.9, 0.3, 0.84), signal: rect(-1.2, 0.9, 0.14, 0.3), red: 8, green: 6, yellow: 1 }),
    // Light B: 1 grid step north of corner (0.6, 0.3). Red 17–24 s, green 24–30 s.
    trafficLight('light-b', { position: { x: 1.15, z: 0.0 }, facing: -Math.PI / 2, crossing: rect(0.6, -0.1, 0.84, 0.3), signal: rect(0.6, 0.3, 0.3, 0.14), red: 7, green: 6, yellow: 1, offset: 11 }),
    ...corridorWalls('hedge', [START, CORNER, GOAL], 0.42, { extendStart: 0.3, extendEnd: 0.5, capEnd: true }),
  ],
});

const stars = { parBlocks: 7, parSeconds: 32 };

export const STARTER_05: LevelDefinition = {
  id: 'starter-05',
  world: 'starter-island',
  number: 5,
  title: 'Traffic Crossing',
  description: 'The traffic lights work again. Cross both zebra crossings on the way to the depot — never on red. Stop at the line and wait for green.',
  difficulty: 2,
  map,
  environmentId: 'starter-beacon-field',
  scene: { path: [{ x: -2.7, z: 0.9 }, CORNER, { x: GOAL.x, z: GOAL.z - 0.3 }], pathWidth: 0.84 },
  mission: standardMission('starter-05', map, { title: 'Traffic Crossing', description: 'Cross both crossings on green and reach the depot.', goalLabel: 'Reach the depot', scoring: scoringFor(stars) }),
  allowedBlocks: TIMING,
  intro: ['Step 2 cells to the first stop line and wait for green', 'Step 3 cells to the corner, turn left, step 1 cell to the second line', 'Wait for green, then step 3 cells to the depot'],
  hints: [
    'Press Run once and watch the timer: light A turns green at 8 s, light B is red from 17 s to 24 s. Each grid step is 60 cm.',
    'step 2 → wait until light A is green → step 3 → turn left → step 1 → wait until light B is green → step 3.',
    'step 2 → wait ? → step 3 → turn left 90 → step 1 → wait ? → step 3.',
    'step 2 → wait 4 → step 3 → turn left 90 → step 1 → wait 6 → step 3.',
  ],
  stars,
  rewards: { xp: 110 },
  briefing: {
    story: 'The island’s traffic lights are working again — and the island’s robots have to obey them like everyone else. The depot is on the other side of two zebra crossings.',
    task: 'Drive to the depot without ever entering a crossing on red.',
    objectives: { primary: 'Reach the depot without crossing on red', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Timing', 'Wait', 'Grid steps', 'Reading a timetable'],
    python: ['robot.step(n)', 'robot.turn_left(90)', 'robot.wait(seconds)'],
    predict: 'The robot drives 25 cm every second. When will it reach the first crossing — and what colour will the light be then?',
    pseudocode: ['drive to the first stop line', 'wait until light A is green', 'drive to the corner and turn', 'drive to the second stop line', 'wait until light B is green', 'drive to the depot'],
    minutes: 8,
    tier: 'medium',
    mechanics: ['traffic'],
  },
};
