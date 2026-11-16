import type { MapEntity } from '@robolab/shared';
import { block, goalArea, levelMap, rect, wall, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { SENSORS } from './kit';

/*
 * Mission 1-14 · Flooded Village — the high street is flooded in places and
 * blocked by fallen trees in others, different after every reset. Water is a
 * danger zone (blue on the colour sensor); trees show up on the obstacle
 * sensor. Either way: back up and go round through the village square.
 *
 * Teaches: hazard zones, combining two sensors with “or”.
 */

const STREET = 0.9;
const START = { x: -2.6, z: STREET, heading: 0 };
const SLOTS = [-1.6, -0.2, 1.2];

type Slot = 'flood' | 'tree' | null;
const flood = (i: number) => zone(`flood-${i}`, 'hazard', rect(SLOTS[i]!, STREET, 0.5, 0.84), { color: 'blue', label: 'FLOOD' });
const tree = (i: number) => wall(`log-tree-${i}`, { x: SLOTS[i]!, z: STREET - 0.22 }, { x: SLOTS[i]!, z: STREET + 0.3 }, 0.16, 0.15);

function layout(id: string, slots: readonly Slot[]): LevelVariant {
  const add: MapEntity[] = [];
  slots.forEach((s, i) => {
    if (s === 'flood') add.push(flood(i));
    if (s === 'tree') add.push(tree(i));
  });
  return { id, add };
}

const map = levelMap({
  id: 'starter-14',
  name: 'Flooded Village',
  size: { x: 6.2, z: 4.4 },
  start: START,
  finish: goalArea(2.3, STREET),
  entities: [
    wall('fence-south', { x: -2.95, z: STREET + 0.42 }, { x: 2.9, z: STREET + 0.42 }),
    wall('fence-north', { x: -2.95, z: -0.9 }, { x: 2.9, z: -0.9 }),
    wall('fence-west', { x: -2.95, z: -0.9 }, { x: -2.95, z: STREET + 0.42 }),
    wall('fence-east', { x: 2.9, z: -0.9 }, { x: 2.9, z: STREET + 0.42 }),
    ...SLOTS.map((x, i) => block(`block-house-${i}`, x, -0.45, 0.5, 0.4, 0.4)),
  ],
});

const stars = { parBlocks: 14, parSeconds: 70 };

export const STARTER_14: LevelDefinition = {
  id: 'starter-14',
  world: 'starter-island',
  number: 14,
  title: 'Flooded Village',
  description: 'The high street is flooded or blocked by fallen trees — in different places every run. Spot water and trees in time and go round them.',
  difficulty: 4,
  map,
  variants: [
    layout('a', ['flood', 'tree', 'flood']),
    layout('b', ['tree', 'flood', null]),
    layout('c', [null, 'flood', 'tree']),
    layout('d', ['flood', 'flood', 'flood']),
  ],
  environmentId: 'starter-sensor-lab',
  scene: { path: [{ x: -2.9, z: STREET }, { x: 2.8, z: STREET }], pathWidth: 0.84 },
  mission: standardMission('starter-14', map, { title: 'Flooded Village', description: 'Avoid the floods and fallen trees and reach the shelter.', goalLabel: 'Reach the shelter', scoring: scoringFor(stars) }),
  allowedBlocks: SENSORS,
  intro: ['Blue floor = flood water: never drive in', 'A tree ahead shows on the obstacle sensor', 'Back up and go round through the village square'],
  hints: [
    'The colour sensor is a little in front of the wheels: it sees the water before the robot drives in. Both dangers need the same detour.',
    'repeat forever { if (colour is blue) or (obstacle ahead) → back up and drive round; move forward a little }.',
    'Detour = move backward 20 → turn left 90 → forward 50 → turn right 90 → forward 100 → turn right 90 → forward 50 → turn left 90.',
    'repeat forever { if colour is blue? or obstacle ahead? → { move backward 20 → turn left 90 → move forward 50 → turn right 90 → move forward 100 → turn right 90 → move forward 50 → turn left 90 }; move forward 5 }.',
  ],
  stars,
  rewards: { xp: 160 },
  briefing: {
    story: 'The river burst its banks in the night. Parts of the village high street are under water and trees have fallen across others — and the water keeps moving. The shelter at the end of the street needs supplies.',
    task: 'Drive down the high street to the shelter, going round every flood and fallen tree.',
    objectives: { primary: 'Reach the shelter without driving into water or hitting a tree', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Hazard zones', 'or', 'Combining sensors', 'Detours'],
    python: ['if robot.color() == "blue" or robot.obstacle_ahead():', 'robot.move_backward(cm)'],
    predict: 'The colour sensor sits 7.5 cm in front of the wheels. Why does that leave just enough time to stop before the water?',
    pseudocode: ['repeat forever:', '    if the floor is blue or something is ahead:', '        back up and drive round through the square', '    move forward a little'],
    minutes: 12,
    tier: 'hard',
    mechanics: ['hazard', 'variants'],
  },
};
