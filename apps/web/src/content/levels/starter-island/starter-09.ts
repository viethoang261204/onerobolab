import type { CargoColor } from '@robolab/shared';
import { cargoStack, goalArea, levelMap, rect, wall, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { COLORS } from './kit';

/*
 * Mission 1-9 · Colour Warehouse — red crates belong in the red warehouse,
 * blue crates in the blue one. The tile in front of the shelf shows the
 * colour of the next crate; the order changes every run, so the robot reads
 * the tile with its colour sensor before each pick-up. A crate in the wrong
 * warehouse fails the job.
 *
 * Teaches: the colour sensor, if / else inside repeat.
 */

const START = { x: -1.8, z: 0, heading: Math.PI };
const TILE = rect(-1.875, 0, 0.12, 0.24);
const stack = (colors: CargoColor[]) => cargoStack('shelf', -2.2, 0, colors, TILE);

const map = levelMap({
  id: 'starter-09',
  name: 'Colour Warehouse',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: goalArea(-1.8, -1.2),
  entities: [
    stack(['red', 'blue', 'blue', 'red']),
    zone('red-store', 'delivery', rect(0.35, 0, 0.5, 0.5), { color: 'red', label: 'RED' }),
    zone('blue-store', 'delivery', rect(-1.8, 1.45, 0.5, 0.5), { color: 'blue', label: 'BLUE' }),
    wall('wall-south', { x: -2.55, z: 1.85 }, { x: 0.8, z: 1.85 }),
    wall('wall-north', { x: -2.55, z: -1.65 }, { x: 0.8, z: -1.65 }),
    wall('wall-west', { x: -2.55, z: -1.65 }, { x: -2.55, z: 1.85 }),
    wall('wall-east', { x: 0.8, z: -1.65 }, { x: 0.8, z: 1.85 }),
    wall('shelf-inner', { x: -1.2, z: 0.5 }, { x: -1.2, z: 1.85 }),
  ],
});

const stars = { parBlocks: 17, parSeconds: 85 };

export const STARTER_09: LevelDefinition = {
  id: 'starter-09',
  world: 'starter-island',
  number: 9,
  title: 'Colour Warehouse',
  description: 'Red crates go to the red warehouse, blue crates to the blue one — and the order changes every run. Read each crate’s colour before you pick it up.',
  difficulty: 3,
  map,
  variants: [
    { id: 'rbbr', remove: ['shelf'], add: [stack(['red', 'blue', 'blue', 'red'])] },
    { id: 'brrb', remove: ['shelf'], add: [stack(['blue', 'red', 'red', 'blue'])] },
    { id: 'bbrr', remove: ['shelf'], add: [stack(['blue', 'blue', 'red', 'red'])] },
  ],
  environmentId: 'starter-ferry-landing',
  scene: { path: [{ x: 0.6, z: 0 }, { x: -1.8, z: 0 }, { x: -1.8, z: 1.6 }, { x: -1.8, z: -1.4 }], pathWidth: 0.7 },
  mission: standardMission('starter-09', map, {
    title: 'Colour Warehouse',
    description: 'Sort the four crates into the warehouse of their colour, then park.',
    tasks: [{ id: 'deliver', type: 'deliverCargo', count: 4, label: 'Sort 4 crates by colour' }],
    goalLabel: 'Park at the charger',
    scoring: scoringFor(stars),
  }),
  allowedBlocks: COLORS,
  intro: ['The tile in front of the shelf shows the next crate’s colour', 'Red → east warehouse, blue → south warehouse', 'Four crates, then park'],
  hints: [
    'Read the tile before picking: the colour sensor sits just in front of the robot, right over the tile.',
    'repeat 4 { if colour is red → (pick up, carry east, drop, come back) else → (pick up, carry south, drop, come back) } → park.',
    'repeat 4 { if colour is red? then → pick up → turn right 180 → move forward 170 → drop → turn left 180 → move forward 170 else → pick up → turn left 90 → move forward ? → drop → move backward ? → turn right 90 } → turn right 90 → move forward 120.',
    'repeat 4 { if colour is red? then → pick up → turn right 180 → move forward 170 → drop → turn left 180 → move forward 170 else → pick up → turn left 90 → move forward 120 → drop → move backward 120 → turn right 90 } → turn right 90 → move forward 120.',
  ],
  stars,
  rewards: { xp: 130 },
  briefing: {
    story: 'The ferry brought supplies for two warehouses: red crates for the workshop, blue crates for the clinic. They were stacked in a hurry — in a different order every time.',
    task: 'Read each crate’s colour, carry it to the warehouse of that colour, then park.',
    objectives: { primary: 'Sort all 4 crates into the right warehouses and park', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Colour sensor', 'if … else', 'repeat', 'Sorting'],
    python: ['robot.color() == "red"', 'robot.pick_up()', 'robot.drop()'],
    predict: 'When is the right moment to read the colour — before or after picking up the crate?',
    pseudocode: ['repeat 4 times:', '    if the tile is red:', '        carry the crate to the red warehouse', '    else:', '        carry it to the blue warehouse', 'park at the charger'],
    minutes: 10,
    tier: 'medium',
    mechanics: ['pickup', 'variants'],
  },
};
