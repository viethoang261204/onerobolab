import { cargoStack, goalArea, levelMap, rect, wall, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { CARGO } from './kit';

/*
 * Mission 1-8 · Cargo Station — the cargo station has three crates of tools
 * for the repair crews. Pick each one up, carry it to the loading dock and
 * come back: the same six steps three times, so a `repeat` block does it.
 *
 * Teaches: pick up / drop, `repeat`.
 */

const START = { x: -1.8, z: 0, heading: Math.PI };

const map = levelMap({
  id: 'starter-08',
  name: 'Cargo Station',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: goalArea(-1.8, -1.2),
  entities: [
    cargoStack('shelf', -2.2, 0, [null, null, null]),
    zone('dock', 'delivery', rect(0.35, 0, 0.5, 0.5), { label: 'DOCK' }),
    wall('wall-south', { x: -2.55, z: 0.5 }, { x: 0.8, z: 0.5 }),
    wall('wall-north', { x: -2.55, z: -1.65 }, { x: 0.8, z: -1.65 }),
    wall('wall-west', { x: -2.55, z: -1.65 }, { x: -2.55, z: 0.5 }),
    wall('wall-east', { x: 0.8, z: -1.65 }, { x: 0.8, z: 0.5 }),
  ],
});

const stars = { parBlocks: 9, parSeconds: 62 };

export const STARTER_08: LevelDefinition = {
  id: 'starter-08',
  world: 'starter-island',
  number: 8,
  title: 'Cargo Station',
  description: 'Three crates of tools wait on the cargo shelf. Carry each one to the loading dock — the same steps three times — then park at the charger.',
  difficulty: 3,
  map,
  environmentId: 'starter-ranger-hut',
  scene: { path: [{ x: 0.6, z: 0 }, { x: -1.8, z: 0 }, { x: -1.8, z: -1.4 }], pathWidth: 0.7 },
  mission: standardMission('starter-08', map, {
    title: 'Cargo Station',
    description: 'Deliver the three crates to the loading dock, then park at the charger.',
    tasks: [{ id: 'deliver', type: 'deliverCargo', count: 3, label: 'Deliver 3 crates to the dock' }],
    goalLabel: 'Park at the charger',
    scoring: scoringFor(stars),
  }),
  allowedBlocks: CARGO,
  intro: ['Pick up the crate in front of the robot', 'Carry it to the dock and drop it', 'Come back — and do it all again with “repeat”'],
  hints: [
    'One delivery is six steps. Three deliveries are the same six steps three times — put them inside a “repeat” block.',
    'repeat 3 { pick up → turn round → drive to the dock → drop → turn round → drive back } → turn to the charger → drive to it.',
    'repeat 3 { pick up crate → turn right 180 → move forward ? → drop crate → turn left 180 → move forward ? } → turn right 90 → move forward 120.',
    'repeat 3 { pick up crate → turn right 180 → move forward 170 → drop crate → turn left 180 → move forward 170 } → turn right 90 → move forward 120.',
  ],
  stars,
  rewards: { xp: 120 },
  briefing: {
    story: 'The repair crews need their tools. The cargo station has three crates on its shelf and your robot is the only one fit to carry them to the loading dock.',
    task: 'Deliver all three crates to the loading dock, then park at the charger.',
    objectives: { primary: 'Deliver 3 crates and park at the charger', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Pick up / drop', 'repeat', 'Patterns'],
    python: ['robot.pick_up()', 'robot.drop()', 'for _ in range(3):'],
    predict: 'Which steps does the robot do for every crate? How many blocks would you need without a repeat block?',
    pseudocode: ['repeat 3 times:', '    pick up the crate', '    carry it to the dock and drop it', '    drive back to the shelf', 'drive to the charger'],
    minutes: 8,
    tier: 'medium',
    mechanics: ['pickup'],
  },
};
