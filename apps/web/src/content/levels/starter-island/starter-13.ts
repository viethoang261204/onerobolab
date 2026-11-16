import type { MapEntity } from '@robolab/shared';
import { block, checkpoint, corridorWalls, goalArea, levelMap, rect, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { SENSORS, colorTile, guideLine, sizeFor } from './kit';

/*
 * Mission 1-13 · Gate 2 — Sensor Challenge (boss). Everything from stage B
 * at once, on a layout that changes with every reset: follow the guide
 * line, drive round the crates that fell on it (wherever they are), and at
 * the end read the exit signal — red: the exit on the right, blue: on the
 * left. The other exit is a danger zone.
 *
 * Teaches: combining sensors in one loop, priorities in if / else if.
 */

const LINE = [
  { x: -2.8, z: 0.4 },
  { x: -0.6, z: 0.4 },
  { x: 0.2, z: -0.4 },
  { x: 2.6, z: -0.4 },
];
const START = { x: -2.8, z: 0.4, heading: 0 };
const EXIT_Z = -0.4;
const RIGHT = { x: 2.3, z: EXIT_Z + 0.8 };
const LEFT = { x: 2.3, z: EXIT_Z - 0.8 };

const crate = (id: string, x: number, z: number) => block(`crate-${id}`, x, z, 0.2, 0.44, 0.22);

/** One layout: where the crates lie and which exit is open. */
function layout(id: string, crate1: number, crate2: number | null, exit: 'red' | 'blue'): LevelVariant {
  const open = exit === 'red' ? RIGHT : LEFT;
  const closed = exit === 'red' ? LEFT : RIGHT;
  const add: MapEntity[] = [
    crate('1', crate1, 0.4),
    ...(crate2 !== null ? [crate('2', crate2, -0.4)] : []),
    colorTile('exit-signal', 2.35, EXIT_Z, exit, 0.2, 0.5),
    zone('wrong-exit', 'hazard', rect(closed.x + 0.1, closed.z, 0.4, 0.4), { label: 'CLOSED' }),
  ];
  return { id, add, finish: goalArea(open.x, open.z) };
}

const VARIANTS = [layout('a', -1.6, 1.3, 'red'), layout('b', -1.9, 1.3, 'blue'), layout('c', -1.3, 1.35, 'blue'), layout('d', -2.0, null, 'red')];

const map = levelMap({
  id: 'starter-13',
  name: 'Sensor Challenge',
  size: sizeFor(LINE, 1.3),
  start: START,
  finish: goalArea(RIGHT.x, RIGHT.z),
  entities: [checkpoint(1, -0.2, 0.0), guideLine('line-guide', LINE), ...corridorWalls('fence', LINE, 1.05, { extendStart: 0.3, extendEnd: 0.5, capEnd: true })],
});

const stars = { parBlocks: 26, parSeconds: 80 };

export const STARTER_13: LevelDefinition = {
  id: 'starter-13',
  world: 'starter-island',
  number: 13,
  title: 'Sensor Challenge',
  description: 'Gate 2: follow the line, drive round fallen crates, then read the exit signal — red: right, blue: left. The layout changes every reset.',
  difficulty: 4,
  map,
  variants: VARIANTS,
  environmentId: 'starter-boat-dock',
  scene: { path: [...LINE, { x: 2.6, z: -0.4 }], pathWidth: 0.9, water: [{ points: [{ x: -3.8, z: 2.4 }, { x: 0, z: 2.2 }, { x: 3.8, z: 2.4 }], width: 1.1, depth: 0.34 }] },
  mission: standardMission('starter-13', map, {
    title: 'Sensor Challenge',
    description: 'Follow the line round the crates and take the exit the signal shows.',
    checkpointLabels: ['Pass the dogleg'],
    goalLabel: 'Leave by the open exit',
    scoring: scoringFor(stars),
  }),
  allowedBlocks: SENSORS,
  intro: ['Follow the line', 'Crate ahead? Drive round it', 'Red signal: exit right · blue signal: exit left'],
  hints: [
    'Order matters: check the crate first, then the exit signal, and only follow the line when nothing else is going on.',
    'repeat forever { if obstacle → detour; else if red → turn right and drive out; else if blue → turn left and drive out; else follow the line }.',
    'Detour = left 90 → forward 60 → right 90 → forward 100 → right 90 → forward 60 → left 90. Exit = turn 90 → forward 80.',
    'repeat forever { if obstacle ahead? → { detour } else → { if colour is red? → { turn right 90 → move forward 80 } else → { if colour is blue? → { turn left 90 → move forward 80 } else → { if line detected? → turn right 15 → move forward 3 else → turn left 15 → move forward 3 } } } }.',
  ],
  stars,
  rewards: { xp: 160 },
  briefing: {
    story: 'Gate 2 guards the road to the robot facility. Its test course is rebuilt after every attempt: crates in new places, a different exit open. Only a robot that senses the world gets through.',
    task: 'Follow the guide line, drive round any crate on it and leave through the exit the signal shows.',
    objectives: { primary: 'Leave through the open exit without touching a crate or the closed exit', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Combining sensors', 'else if priorities', 'Line following', 'Randomised layouts'],
    python: ['if robot.obstacle_ahead():', 'elif robot.color() == "red":', 'elif robot.on_line():'],
    predict: 'If the line check came first, would the robot ever notice the crate or the exit signal? Why does the order of the checks matter?',
    pseudocode: ['repeat forever:', '    if a crate is ahead: detour', '    else if the signal is red: exit right', '    else if the signal is blue: exit left', '    else: follow the line'],
    minutes: 14,
    tier: 'boss',
    mechanics: ['variants', 'hazard'],
  },
};
