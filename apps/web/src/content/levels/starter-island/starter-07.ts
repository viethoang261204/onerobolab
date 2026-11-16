import type { MapEntity } from '@robolab/shared';
import { goalArea, levelMap, wall } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { DECISIONS } from './kit';

/*
 * Mission 1-7 · Broken Bridge — two bridges lead over the river to the
 * forest camp. On every run (press Reset) a fallen log blocks one of them.
 * The robot can't know which in advance: it drives to the near bridge and
 * checks with the obstacle sensor — blocked? take the far bridge.
 *
 * Teaches: the first `if … else`, the obstacle sensor.
 */

const START = { x: -2.4, z: 0.9, heading: 0 };
/** The ring road round the river island (centre lines x ±1.2, z 0.9 / -1.5), lanes 84 cm. */
const H = 0.42;
const ring: MapEntity[] = [
  wall('fence-o-north', { x: -1.2 - H, z: -1.5 - H }, { x: 1.2 + H, z: -1.5 - H }),
  wall('fence-o-east', { x: 1.2 + H, z: -1.5 - H }, { x: 1.2 + H, z: 0.9 + H }),
  wall('fence-o-south', { x: -2.7, z: 0.9 + H }, { x: 1.2 + H, z: 0.9 + H }),
  wall('fence-o-west', { x: -1.2 - H, z: -1.5 - H }, { x: -1.2 - H, z: 0.9 - H }),
  wall('fence-stub', { x: -2.7, z: 0.9 - H }, { x: -1.2 - H, z: 0.9 - H }),
  wall('fence-cap', { x: -2.7, z: 0.9 - H }, { x: -2.7, z: 0.9 + H }),
  wall('fence-i-north', { x: -1.2 + H, z: -1.5 + H }, { x: 1.2 - H, z: -1.5 + H }),
  wall('fence-i-east', { x: 1.2 - H, z: -1.5 + H }, { x: 1.2 - H, z: 0.9 - H }),
  wall('fence-i-south', { x: -1.2 + H, z: 0.9 - H }, { x: 1.2 - H, z: 0.9 - H }),
  wall('fence-i-west', { x: -1.2 + H, z: -1.5 + H }, { x: -1.2 + H, z: 0.9 - H }),
];
/** A fallen log across a bridge entrance. */
const log = (id: string, x: number) => wall(id, { x: x - 0.3, z: 0.6 }, { x: x + 0.3, z: 0.6 }, 0.12, 0.1);

const map = levelMap({
  id: 'starter-07',
  name: 'Broken Bridge',
  size: { x: 6, z: 4.6 },
  start: START,
  finish: goalArea(0, -1.5),
  entities: ring,
});

const stars = { parBlocks: 13, parSeconds: 36 };

export const STARTER_07: LevelDefinition = {
  id: 'starter-07',
  world: 'starter-island',
  number: 7,
  title: 'Broken Bridge',
  description: 'A fallen log blocks one of the two river bridges — a different one each run. Check the near bridge with the obstacle sensor and choose your way.',
  difficulty: 3,
  map,
  variants: [
    { id: 'near-blocked', add: [log('log-near', -1.2)] },
    { id: 'far-blocked', add: [log('log-far', 1.2)] },
  ],
  environmentId: 'starter-log-bridge',
  scene: {
    path: [{ x: -2.7, z: 0.9 }, { x: 1.2, z: 0.9 }, { x: 1.2, z: -1.5 }, { x: -1.2, z: -1.5 }, { x: -1.2, z: 0.9 }],
    pathWidth: 0.84,
    bridges: [
      { from: { x: -1.2, z: 0.1 }, to: { x: -1.2, z: -0.7 }, width: 0.84, style: 'log' },
      { from: { x: 1.2, z: 0.1 }, to: { x: 1.2, z: -0.7 }, width: 0.84, style: 'log' },
    ],
    water: [{ points: [{ x: -3.6, z: -0.35 }, { x: 0, z: -0.25 }, { x: 3.6, z: -0.35 }], width: 0.5, depth: 0.3 }],
  },
  mission: standardMission('starter-07', map, { title: 'Broken Bridge', description: 'Find the open bridge and reach the forest camp.', goalLabel: 'Reach the forest camp', scoring: scoringFor(stars) }),
  allowedBlocks: DECISIONS,
  intro: ['Drive to the near bridge and face it', 'Obstacle ahead? Take the far bridge', 'Otherwise cross right here'],
  hints: [
    'Press Reset a few times: the log moves. One program has to work both ways — the robot must look before it chooses.',
    'drive to the near bridge → turn towards it → if obstacle ahead → (go to the far bridge, cross, drive to the camp) else → (cross here, drive to the camp).',
    'move forward 140 → turn left 90 → if obstacle ahead? then → turn right 90 → move forward 200 → turn left 90 → move forward ? → turn left 90 → move forward 100 else → move forward ? → turn right 90 → move forward 100.',
    'move forward 140 → turn left 90 → if obstacle ahead? then → turn right 90 → move forward 200 → turn left 90 → move forward 220 → turn left 90 → move forward 100 else → move forward 220 → turn right 90 → move forward 100.',
  ],
  stars,
  rewards: { xp: 120 },
  briefing: {
    story: 'The forest camp across the river needs help, but the storm toppled trees onto the log bridges. Each time, a different bridge is blocked — the robot has to check before it chooses.',
    task: 'Look at the near bridge with the obstacle sensor and take whichever bridge is open to the forest camp.',
    objectives: { primary: 'Reach the forest camp over an open bridge', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['if … else', 'Obstacle sensor', 'Alternative routes'],
    python: ['if robot.obstacle_ahead():', 'else:', 'robot.move_forward(cm)'],
    predict: 'Press Reset twice and watch the log. Why can’t a program with only moves work every time?',
    pseudocode: ['drive to the near bridge and face it', 'if something is ahead:', '    take the far bridge to the camp', 'else:', '    cross here to the camp'],
    minutes: 10,
    tier: 'medium',
    mechanics: ['variants'],
  },
};
