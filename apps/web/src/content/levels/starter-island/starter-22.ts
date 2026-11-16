import { goalArea, levelMap } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { FUNCTIONS, maze } from './kit';

/*
 * Mission 1-22 · Autonomous Explorer (boss) — the old research tunnels are
 * full of fog. Nobody knows the layout (it is different on every run) and
 * the minimap only shows where the robot has already been. Somewhere inside
 * is the lost survey beacon. Explore with the right-hand rule — sensors only.
 *
 * Teaches: sensor-driven exploration, nested decisions, fog of war.
 */

const COLS = 6;
const ROWS = 4;
const CELL = 0.8;
const ORIGIN = { x: -(COLS * CELL) / 2, z: (ROWS * CELL) / 2 };
const BASE = maze('cliff', COLS, ROWS, CELL, ORIGIN, 7);
const start = BASE.center(0, 0);

function layout(seed: number, exit: readonly [number, number]): LevelVariant {
  const m = maze('cliff', COLS, ROWS, CELL, ORIGIN, seed);
  const goal = m.center(...exit);
  return { id: `tunnels-${seed}`, remove: BASE.walls.map((w) => String(w.id)), add: m.walls, finish: goalArea(goal.x, goal.z, 0.5) };
}

const VARIANTS = [layout(7, [5, 3]), layout(3, [5, 0]), layout(11, [3, 3]), layout(23, [4, 1])];

const map = levelMap({
  id: 'starter-22',
  name: 'Autonomous Explorer',
  size: { x: COLS * CELL + 1.2, z: ROWS * CELL + 1.2 },
  start: { x: start.x, z: start.z, heading: 0 },
  finish: goalArea(BASE.center(5, 3).x, BASE.center(5, 3).z, 0.5),
  entities: BASE.walls,
});

const stars = { parBlocks: 16, parSeconds: 90 };

export const STARTER_22: LevelDefinition = {
  id: 'starter-22',
  world: 'starter-island',
  number: 22,
  title: 'Autonomous Explorer',
  description: 'Fog fills the research tunnels and their layout changes every run. Find the lost survey beacon with sensors only: keep your right hand on the wall.',
  difficulty: 5,
  map,
  variants: VARIANTS,
  editor: 'python',
  fog: true,
  environmentId: 'starter-fallen-trees',
  // The floor shows no corridors: the tunnels differ on every run (fog of war).
  scene: { path: [{ x: start.x - 0.3, z: start.z }, { x: start.x + 0.2, z: start.z }], pathWidth: 0.5 },
  mission: standardMission('starter-22', map, { title: 'Autonomous Explorer', description: 'Explore the foggy tunnels and find the survey beacon.', goalLabel: 'Find the survey beacon', scoring: scoringFor(stars) }),
  allowedBlocks: FUNCTIONS,
  intro: ['The tunnels are a grid of 80 cm cells', 'At every cell: try right, then straight, then left, then back', 'Then drive one cell — forever, until the beacon'],
  hints: [
    'Keeping your right hand on the wall always leads through a maze like this one — every cell gets visited, so the beacon is found wherever it is.',
    'forever { turn right; while a wall is close in front → turn left; drive one cell }.',
    'robot.set_speed(100)\nwhile True:\n    robot.turn_right(90)\n    while robot.distance() < 40:\n        robot.turn_left(90)\n    robot.move_forward(?)',
    'robot.set_speed(100)\nwhile True:\n    robot.turn_right(90)\n    while robot.distance() < 40:\n        robot.turn_left(90)\n    robot.move_forward(80)',
  ],
  stars,
  rewards: { xp: 210 },
  briefing: {
    story: 'The survey beacon that maps the island was lost in the old research tunnels, and the storm filled them with fog. Nobody has a map — the tunnels even shifted since the last survey.',
    task: 'Explore the tunnels with your sensors and reach the survey beacon.',
    objectives: { primary: 'Find the survey beacon without crashing', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Exploration algorithms', 'Right-hand rule', 'Nested loops', 'Fog of war'],
    python: ['while True:', 'while robot.distance() < 40:', 'robot.turn_left(90)'],
    predict: 'In a dead end, which way does the robot turn after trying right, straight and left? What happens next?',
    pseudocode: ['forever:', '    turn right', '    while there is a wall ahead: turn left', '    drive one cell'],
    minutes: 15,
    tier: 'boss',
    mechanics: ['fog', 'variants'],
  },
};
