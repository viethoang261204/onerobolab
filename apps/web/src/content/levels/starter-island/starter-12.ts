import { checkpoint, corridorWalls, goalArea, levelMap } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { SENSORS, guideLine, midOf, sizeFor } from './kit';

/*
 * Mission 1-12 · Line Rescue — a fisher is stranded at the end of the
 * harbour. Rescue robots follow the painted guide line along the quay: nine
 * bends both ways, far too many to measure. A line follower — steer right
 * on the line, left off it — gets there.
 *
 * Teaches: the line sensor, a feedback loop.
 */

const LINE = [
  { x: -2.8, z: 0.9 },
  { x: -1.8, z: 0.9 },
  { x: -1.1, z: 0.2 },
  { x: 0.0, z: 0.2 },
  { x: 0.6, z: 0.9 },
  { x: 1.6, z: 0.9 },
  { x: 2.2, z: 0.3 },
  { x: 2.2, z: -0.6 },
  { x: 1.4, z: -1.3 },
  { x: 0.2, z: -1.3 },
];
const START = { x: -2.8, z: 0.9, heading: 0 };
const end = LINE[LINE.length - 1]!;

const map = levelMap({
  id: 'starter-12',
  name: 'Line Rescue',
  size: sizeFor(LINE, 1.0),
  start: START,
  finish: goalArea(end.x, end.z),
  entities: [
    checkpoint(1, midOf(LINE, 3).x, midOf(LINE, 3).z),
    checkpoint(2, midOf(LINE, 6).x, midOf(LINE, 6).z),
    guideLine('line-guide', LINE),
    ...corridorWalls('fence', LINE, 0.62, { extendStart: 0.3, extendEnd: 0.5, capEnd: true }),
  ],
});

const stars = { parBlocks: 7, parSeconds: 100 };

export const STARTER_12: LevelDefinition = {
  id: 'starter-12',
  world: 'starter-island',
  number: 12,
  title: 'Line Rescue',
  description: 'A fisher is stranded at the end of the harbour. Follow the painted rescue line along the quay — nine bends, both ways. Write a line follower.',
  difficulty: 4,
  map,
  environmentId: 'starter-harbour-spiral',
  scene: { path: LINE, pathWidth: 0.7, water: [{ points: [{ x: -3.8, z: 2.3 }, { x: 0, z: 2.15 }, { x: 3.8, z: 2.3 }], width: 0.9, depth: 0.3 }] },
  mission: standardMission('starter-12', map, {
    title: 'Line Rescue',
    description: 'Follow the rescue line to the stranded fisher.',
    checkpointLabels: ['Pass the boat ramp', 'Pass the crane'],
    goalLabel: 'Reach the fisher',
    scoring: scoringFor(stars),
  }),
  allowedBlocks: SENSORS,
  intro: ['Keep the line sensor on the edge of the line', 'On the line: steer right. Off the line: steer left', 'Small steps, repeated forever'],
  hints: [
    'A line follower wiggles along one edge of the line: it never needs to know where the bends are.',
    'repeat forever { if line detected → turn a little right and step; else → turn a little left and step }.',
    'repeat forever { if line detected? then → turn right ? → move forward 3 else → turn left ? → move forward 3 }.',
    'repeat forever { if line detected? then → turn right 15 → move forward 3 else → turn left 15 → move forward 3 }.',
  ],
  stars,
  rewards: { xp: 140 },
  briefing: {
    story: 'The storm surge cut off the end of the harbour, and a fisher is waiting there. The island painted rescue lines on the quays so robots can find their way without a map.',
    task: 'Follow the rescue line all the way to the stranded fisher.',
    objectives: { primary: 'Reach the fisher along the rescue line', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Line sensor', 'Feedback loop', 'repeat forever', 'if … else'],
    python: ['while True:', 'if robot.on_line():', 'robot.turn_right(degrees)'],
    predict: 'The line has nine bends. Why does a program with only two small moves still follow every one of them?',
    pseudocode: ['repeat forever:', '    if the sensor sees the line: turn a little right, step', '    else: turn a little left, step'],
    minutes: 10,
    tier: 'hard',
    mechanics: [],
  },
};
