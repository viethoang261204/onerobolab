import { block, levelMap, rect } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { LOOPS, laneWithBays } from './kit';

/*
 * Mission 1-18 · Smart Parking — the charging car park has five bays, 70 cm
 * apart. Which ones are taken changes every run. The robot checks each bay
 * with the distance sensor (a parked car is close, an empty bay is deep) and
 * parks in the FIRST free one: `while True` … `break`.
 *
 * Teaches: while + break, searching, thresholds.
 */

const LANE = 0.6;
const START = { x: -2.6, z: LANE, heading: 0 };
const BAY_X = (k: number) => -1.9 + 0.7 * (k - 1);
const BAYS = [1, 2, 3, 4, 5];
const PARK_Z = LANE - 0.6;

const car = (k: number) => block(`block-car-${k}`, BAY_X(k), -0.2, 0.3, 0.45, 0.22);
const layout = (free: number, cars: readonly number[]): LevelVariant => ({
  id: `free-${free}`,
  remove: BAYS.map((k) => `block-car-${k}`),
  add: cars.map(car),
  finish: rect(BAY_X(free), PARK_Z - 0.05, 0.45, 0.5),
});

const map = levelMap({
  id: 'starter-18',
  name: 'Smart Parking',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: rect(BAY_X(2), PARK_Z - 0.05, 0.45, 0.5),
  entities: [...[1, 3, 5].map(car), ...laneWithBays('rail', LANE, -2.95, 1.5, BAYS.map((k) => ({ x: BAY_X(k), side: -1 as const, depth: 0.8 })))],
});

const stars = { parBlocks: 10, parSeconds: 40 };

export const STARTER_18: LevelDefinition = {
  id: 'starter-18',
  world: 'starter-island',
  number: 18,
  title: 'Smart Parking',
  description: 'Five charging bays, some taken — different ones every run. Look into each bay with the distance sensor and park in the first free one.',
  difficulty: 4,
  map,
  variants: [layout(2, [1, 3, 5]), layout(3, [1, 2, 4]), layout(4, [1, 2, 3, 5]), layout(5, [1, 2, 3, 4])],
  editor: 'python',
  environmentId: 'starter-energy-spiral',
  scene: { path: [{ x: -2.9, z: LANE }, { x: 1.4, z: LANE }], pathWidth: 0.84 },
  mission: standardMission('starter-18', map, { title: 'Smart Parking', description: 'Park in the first free charging bay.', goalLabel: 'Park in the first free bay', stopInFinish: true, scoring: scoringFor(stars) }),
  allowedBlocks: LOOPS,
  intro: ['Face each bay: a car reads about 40 cm, an empty bay much more', 'Free? Stop looking (break) and drive in', 'Taken? Turn back and drive 70 cm to the next bay'],
  hints: [
    'You don’t know how many bays you’ll have to check: loop forever and break out as soon as you find a free one.',
    'drive to bay 1 → while True { turn towards the bay; if it is free → break; turn back; drive to the next bay } → drive in.',
    'robot.move_forward(70)\nwhile True:\n    robot.turn_left(90)\n    if robot.distance() > 60:\n        break\n    robot.turn_right(90)\n    robot.move_forward(?)\nrobot.move_forward(?)',
    'robot.move_forward(70)\nwhile True:\n    robot.turn_left(90)\n    if robot.distance() > 60:\n        break\n    robot.turn_right(90)\n    robot.move_forward(70)\nrobot.move_forward(60)',
  ],
  stars,
  rewards: { xp: 180 },
  briefing: {
    story: 'The new charging car park opened today and the robots have to find their own bays. Cars come and go, so the free bays are never the same.',
    task: 'Check the bays one by one and park in the first free bay.',
    objectives: { primary: 'Park in the first free bay', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['while True', 'break', 'Searching', 'Distance thresholds'],
    python: ['while True:', 'if robot.distance() > 60:', 'break'],
    predict: 'How far does the distance sensor read in an empty bay, and in front of a parked car? Which threshold separates them safely?',
    pseudocode: ['drive to the first bay', 'loop:', '    face the bay', '    if it is free: stop looking', '    face the street again, drive to the next bay', 'drive into the bay'],
    minutes: 12,
    tier: 'hard',
    mechanics: ['variants'],
  },
};
