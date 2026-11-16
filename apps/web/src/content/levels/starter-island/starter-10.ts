import { gate, levelMap, rect, wall } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { DISTANCE } from './kit';

/*
 * Mission 1-10 · Smart Gate — the dock's security gate opens for robots that
 * wait at its scanner (the cyan pad, 25–65 cm before the gate) for a second.
 * The robot starts somewhere else on every run, so it has to measure the
 * distance to the gate instead of counting centimetres.
 *
 * Teaches: the distance sensor, thresholds, `repeat until`.
 */

const LANE = 0;
const start = (x: number) => ({ x, z: LANE, heading: 0 });
const PAD = rect(1.65, LANE, 0.5, 0.5);

const map = levelMap({
  id: 'starter-10',
  name: 'Smart Gate',
  size: { x: 6, z: 4.4 },
  start: start(-2.37),
  finish: PAD,
  entities: [
    gate('gate', { x: 0.8, z: LANE - 0.42 }, { x: 0.8, z: LANE + 0.42 }, rect(0.45, LANE, 0.4, 0.6), 1),
    wall('rail-north', { x: -2.9, z: LANE - 0.42 }, { x: 2.2, z: LANE - 0.42 }),
    wall('rail-south', { x: -2.9, z: LANE + 0.42 }, { x: 2.2, z: LANE + 0.42 }),
    wall('rail-west', { x: -2.9, z: LANE - 0.42 }, { x: -2.9, z: LANE + 0.42 }),
    wall('dock-east', { x: 2.2, z: LANE - 0.42 }, { x: 2.2, z: LANE + 0.42 }, 0.5, 0.1),
  ],
});

const stars = { parBlocks: 6, parSeconds: 22 };

export const STARTER_10: LevelDefinition = {
  id: 'starter-10',
  world: 'starter-island',
  number: 10,
  title: 'Smart Gate',
  description: 'The dock gate opens only for robots that wait at its scanner. The robot starts in a different place every run: measure the distance to the gate.',
  difficulty: 3,
  map,
  variants: [{ id: 'far', start: start(-2.37) }, { id: 'middle', start: start(-1.92) }, { id: 'near', start: start(-1.48) }],
  environmentId: 'starter-river-docks',
  scene: { path: [{ x: -2.9, z: LANE }, { x: 2.1, z: LANE }], pathWidth: 0.84, water: [{ points: [{ x: -3.6, z: -1.6 }, { x: 0, z: -1.5 }, { x: 3.6, z: -1.6 }], width: 1.0, depth: 0.34 }] },
  mission: standardMission('starter-10', map, {
    title: 'Smart Gate',
    description: 'Wait at the scanner, pass the gate and stop on the dock pad.',
    goalLabel: 'Stop on the dock pad',
    stopInFinish: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: DISTANCE,
  intro: ['Creep towards the gate until it is less than 30 cm away', 'Wait at the scanner until the gate lifts', 'Drive through and stop on the dock pad'],
  hints: [
    'Press Reset: the robot starts somewhere else each time. “distance” tells you how far the gate is — drive in small steps until it is close.',
    'repeat until distance < 30 { move forward a little } → wait for the gate → drive onto the pad.',
    'repeat until distance (cm) < 30 { move forward 5 } → wait 2 → move forward ?',
    'repeat until distance (cm) < 30 { move forward 5 } → wait 2 → move forward 125.',
  ],
  stars,
  rewards: { xp: 130 },
  briefing: {
    story: 'The river docks are back in business and their smart gate checks every robot. It only lifts when a robot waits on the scanner pad — and today the robots arrive from all over the yard.',
    task: 'Drive up to the gate, wait at the scanner until it opens, then stop on the dock pad.',
    objectives: { primary: 'Pass the smart gate and stop on the dock pad', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Distance sensor', 'Thresholds', 'repeat until', 'Feedback'],
    python: ['robot.distance()', 'while not robot.distance() < 30:', 'robot.wait(seconds)'],
    predict: 'If the robot always drove 260 cm, what would happen when it starts closer to the gate?',
    pseudocode: ['repeat until the gate is closer than 30 cm:', '    move forward a little', 'wait at the scanner', 'drive onto the dock pad'],
    minutes: 8,
    tier: 'medium',
    mechanics: ['gate', 'variants'],
  },
};

