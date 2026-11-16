import { goalArea, levelMap, rect, trafficLight, wall } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { FOREVER } from './kit';

/*
 * Mission 1-11 · Traffic Controller — Signal Avenue has three traffic lights
 * on their own timetables. The tile before each crossing shows the light's
 * colour: red → wait, yellow → slow down, green → full speed. A program that
 * reacts to the signals works whatever the timing.
 *
 * Teaches: if / else if / else (elif), speed control, repeat forever.
 */

const LANE = 0;
const START = { x: -2.6, z: LANE, heading: 0 };
/** Crossing centres (x) with their timetables. */
const LIGHTS = [
  { x: -1.3, red: 5, green: 5, yellow: 2, offset: 0 },
  { x: 0.1, red: 4, green: 5, yellow: 2, offset: 3 },
  { x: 1.5, red: 6, green: 5, yellow: 2, offset: 7 },
];

const map = levelMap({
  id: 'starter-11',
  name: 'Signal Avenue',
  size: { x: 6.4, z: 4.4 },
  start: START,
  finish: goalArea(2.55, LANE),
  entities: [
    ...LIGHTS.map((l, i) =>
      trafficLight(`light-${i + 1}`, {
        position: { x: l.x - 0.25, z: LANE - 0.6 },
        facing: Math.PI,
        crossing: rect(l.x, LANE, 0.3, 0.84),
        signal: rect(l.x - 0.245, LANE, 0.15, 0.3),
        red: l.red,
        green: l.green,
        yellow: l.yellow,
        offset: l.offset,
      }),
    ),
    wall('rail-north', { x: -2.95, z: LANE - 0.42 }, { x: 2.95, z: LANE - 0.42 }),
    wall('rail-south', { x: -2.95, z: LANE + 0.42 }, { x: 2.95, z: LANE + 0.42 }),
    wall('rail-west', { x: -2.95, z: LANE - 0.42 }, { x: -2.95, z: LANE + 0.42 }),
    wall('rail-east', { x: 2.95, z: LANE - 0.42 }, { x: 2.95, z: LANE + 0.42 }),
  ],
});

const stars = { parBlocks: 10, parSeconds: 30 };

export const STARTER_11: LevelDefinition = {
  id: 'starter-11',
  world: 'starter-island',
  number: 11,
  title: 'Traffic Controller',
  description: 'Three traffic lights on Signal Avenue, each on its own timetable. Read the signal tile: red → wait, yellow → slow down, green → full speed.',
  difficulty: 4,
  map,
  environmentId: 'starter-stepping-stones',
  scene: { path: [{ x: -2.95, z: LANE }, { x: 2.9, z: LANE }], pathWidth: 0.84 },
  mission: standardMission('starter-11', map, { title: 'Traffic Controller', description: 'Obey all three lights and reach the end of Signal Avenue.', goalLabel: 'Reach the end of the avenue', scoring: scoringFor(stars) }),
  allowedBlocks: FOREVER,
  intro: ['The tile before each crossing shows its light', 'Red: wait · yellow: slow · green: full speed', 'Drive in small steps inside “repeat forever”'],
  hints: [
    'Don’t time the lights — react to them. The colour sensor reads the signal tile just before each crossing.',
    'repeat forever { if red → wait a moment, else if yellow → slow speed and a small step, else → full speed and a small step }.',
    'repeat forever { if colour is red? then → wait 0.1 else → if colour is yellow? then → set speed to ? → move forward 5 else → set speed to ? → move forward 5 }.',
    'repeat forever { if colour is red? then → wait 0.1 else → if colour is yellow? then → set speed to 30 → move forward 5 else → set speed to 100 → move forward 5 }.',
  ],
  stars,
  rewards: { xp: 140 },
  briefing: {
    story: 'Signal Avenue is the island’s busiest street and its three traffic lights run on different timetables. Your robot will be the first autonomous delivery van to drive it.',
    task: 'Drive the whole avenue reacting to each light: wait on red, slow down on yellow, full speed on green.',
    objectives: { primary: 'Reach the end of the avenue without crossing on red', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['if / else if / else', 'Speed control', 'Signal states', 'repeat forever'],
    python: ['if robot.color() == "red":', 'elif robot.color() == "yellow":', 'else:', 'robot.set_speed(percent)'],
    predict: 'What should the robot do on yellow? Why is it safer to react to the light than to count seconds?',
    pseudocode: ['repeat forever:', '    if the signal is red: wait', '    else if it is yellow: slow down, small step', '    else: full speed, small step'],
    minutes: 10,
    tier: 'hard',
    mechanics: ['traffic'],
  },
};
