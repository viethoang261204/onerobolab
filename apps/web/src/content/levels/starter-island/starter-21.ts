import type { CargoColor } from '@robolab/shared';
import { cargoStack, goalArea, levelMap, rect, wall, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { FUNCTIONS } from './kit';

/*
 * Mission 1-21 · Robot Factory — the outpost factory restarts: ten parts on
 * the feeder, red ones for the motor line, blue ones for the sensor line,
 * mixed differently every shift. Ten deliveries of two kinds: write each
 * kind once as a function and call it from a loop.
 *
 * Teaches: functions (def), calling them, for × 10.
 */

const START = { x: -1.6, z: 0, heading: Math.PI };
const TILE = rect(-1.675, 0, 0.12, 0.24);
const feeder = (colors: readonly CargoColor[]) => cargoStack('feeder', -2.0, 0, colors, TILE);
const SHIFTS: readonly (readonly CargoColor[])[] = [
  ['red', 'blue', 'blue', 'red', 'red', 'blue', 'red', 'blue', 'blue', 'red'],
  ['blue', 'blue', 'red', 'blue', 'red', 'red', 'blue', 'red', 'red', 'blue'],
  ['red', 'red', 'red', 'blue', 'blue', 'blue', 'red', 'blue', 'red', 'blue'],
];

const map = levelMap({
  id: 'starter-21',
  name: 'Robot Factory',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: goalArea(-1.6, -1.2),
  entities: [
    feeder(SHIFTS[0]!),
    zone('motor-line', 'delivery', rect(0.35, 0, 0.5, 0.5), { color: 'red', label: 'MOTORS' }),
    zone('sensor-line', 'delivery', rect(-1.6, 1.45, 0.5, 0.5), { color: 'blue', label: 'SENSORS' }),
    wall('wall-south', { x: -2.4, z: 1.85 }, { x: 0.8, z: 1.85 }),
    wall('wall-north', { x: -2.4, z: -1.65 }, { x: 0.8, z: -1.65 }),
    wall('wall-west', { x: -2.4, z: -1.65 }, { x: -2.4, z: 1.85 }),
    wall('wall-east', { x: 0.8, z: -1.65 }, { x: 0.8, z: 1.85 }),
    wall('shelf-inner', { x: -1.1, z: 0.5 }, { x: -1.1, z: 1.85 }),
  ],
});

const stars = { parBlocks: 22, parSeconds: 95 };

export const STARTER_21: LevelDefinition = {
  id: 'starter-21',
  world: 'starter-island',
  number: 21,
  title: 'Robot Factory',
  description: 'Ten parts on the feeder: red to the motor line, blue to the sensor line, mixed differently every shift. Write each delivery once, as a function.',
  difficulty: 5,
  map,
  variants: SHIFTS.map((colors, i) => ({ id: `shift-${i + 1}`, remove: ['feeder'], add: [feeder(colors)] })),
  editor: 'python',
  environmentId: 'starter-supply-outpost',
  scene: { path: [{ x: 0.6, z: 0 }, { x: -1.6, z: 0 }, { x: -1.6, z: 1.6 }, { x: -1.6, z: -1.4 }], pathWidth: 0.7 },
  mission: standardMission('starter-21', map, {
    title: 'Robot Factory',
    description: 'Deliver all ten parts to the right lines, then park.',
    tasks: [{ id: 'deliver', type: 'deliverCargo', count: 10, label: 'Deliver 10 parts to the right lines' }],
    goalLabel: 'Park at the charger',
    scoring: scoringFor(stars),
  }),
  allowedBlocks: FUNCTIONS,
  intro: ['Red part → motor line (east) · blue part → sensor line (south)', 'Write each delivery once: def to_motors(): …', 'Call them from a loop that runs 10 times'],
  hints: [
    'Without functions this program would be over 100 blocks. Each kind of delivery is always the same moves — give each a name.',
    'def to_motors(): (pick up, carry east, drop, come back) · def to_sensors(): (pick up, carry south, drop, come back) · repeat 10 { if red → to_motors() else → to_sensors() }.',
    'def to_motors():\n    robot.pick_up()\n    robot.turn_right(180)\n    robot.move_forward(170)\n    robot.drop()\n    robot.turn_left(180)\n    robot.move_forward(170)\n\ndef to_sensors():\n    …\n\nfor _ in range(10):\n    if robot.color() == "red":\n        to_motors()\n    else:\n        to_sensors()',
    'def to_motors():\n    robot.pick_up(); robot.turn_right(180); robot.move_forward(170); robot.drop(); robot.turn_left(180); robot.move_forward(170)\ndef to_sensors():\n    robot.pick_up(); robot.turn_left(90); robot.move_forward(120); robot.drop(); robot.move_backward(120); robot.turn_right(90)\nrobot.set_speed(100)\nfor _ in range(10): if red → to_motors() else → to_sensors()\nrobot.turn_right(90)\nrobot.move_forward(120)   (one instruction per line in your program)',
  ],
  stars,
  rewards: { xp: 200 },
  briefing: {
    story: 'The outpost factory is building new rescue robots. Its feeder is full of parts — motor parts in red, sensor parts in blue — and the assembly lines are waiting.',
    task: 'Deliver all ten parts to the line of their colour, then park at the charger.',
    objectives: { primary: 'Sort all 10 parts and park', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Functions', 'def', 'for × 10', 'Reusing code'],
    python: ['def to_motors():', 'to_motors()', 'for _ in range(10):'],
    predict: 'How many blocks would ten deliveries take without functions? How many with them?',
    pseudocode: ['def to_motors(): deliver east and come back', 'def to_sensors(): deliver south and come back', 'repeat 10 times:', '    if the tile is red: to_motors()', '    else: to_sensors()', 'park'],
    minutes: 14,
    tier: 'hard',
    mechanics: ['functions', 'pickup', 'variants'],
  },
};
