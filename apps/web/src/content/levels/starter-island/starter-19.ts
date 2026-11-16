import { checkpoint, levelMap, rect, wall } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { POSITION } from './kit';

/*
 * Mission 1-19 · Delivery Network — the canyon outposts send their parcel
 * points as coordinates (cm): mission.x1 / y1 and mission.x2 / y2, new ones
 * every run. The robot knows where it is (robot.x(), robot.y()), so the
 * distance to drive is simply target − position. Visit both points, return
 * to the depot (−240, −140) and stop.
 *
 * Teaches: coordinates, subtraction, driving backwards with negative distances.
 */

/** Student coordinates: x = world x, y = −world z (cm). */
const world = (x: number, y: number) => ({ x: x / 100, z: -y / 100 });
const DEPOT = { x: -240, y: -140 };
const START = { ...world(DEPOT.x, DEPOT.y), heading: 0 };

function layout(id: string, x1: number, y1: number, x2: number, y2: number): LevelVariant {
  const a = world(x1, y1);
  const b = world(x2, y2);
  return { id, remove: ['cp-1', 'cp-2'], add: [checkpoint(1, a.x, a.z, 0.18), checkpoint(2, b.x, b.z, 0.18)], data: { x1, y1, x2, y2 } };
}

const VARIANTS = [layout('a', -60, 60, 140, -20), layout('b', 100, -100, -120, 80), layout('c', 40, 100, 180, 120), layout('d', -150, 20, 60, -60)];

const map = levelMap({
  id: 'starter-19',
  name: 'Delivery Network',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: rect(START.x, START.z, 0.4, 0.4),
  entities: [
    checkpoint(1, world(-60, 60).x, world(-60, 60).z, 0.18),
    checkpoint(2, world(140, -20).x, world(140, -20).z, 0.18),
    wall('fence-north', { x: -2.9, z: -2.0 }, { x: 2.9, z: -2.0 }),
    wall('fence-south', { x: -2.9, z: 2.0 }, { x: 2.9, z: 2.0 }),
    wall('fence-west', { x: -2.9, z: -2.0 }, { x: -2.9, z: 2.0 }),
    wall('fence-east', { x: 2.9, z: -2.0 }, { x: 2.9, z: 2.0 }),
  ],
});

const stars = { parBlocks: 30, parSeconds: 70 };

export const STARTER_19: LevelDefinition = {
  id: 'starter-19',
  world: 'starter-island',
  number: 19,
  title: 'Delivery Network',
  description: 'Parcel points arrive as coordinates (mission.x1, y1, x2, y2), new ones every run. Drive target − position, visit both, then return to the depot.',
  difficulty: 5,
  map,
  data: { x1: -60, y1: 60, x2: 140, y2: -20 },
  variants: VARIANTS,
  editor: 'python',
  environmentId: 'starter-canyon-switchbacks',
  scene: { path: [{ x: START.x - 0.3, z: START.z }, { x: 2.6, z: START.z }], pathWidth: 0.6 },
  mission: standardMission('starter-19', map, {
    title: 'Delivery Network',
    description: 'Visit both parcel points, then stop back at the depot.',
    checkpointLabels: ['Deliver to point 1', 'Deliver to point 2'],
    goalLabel: 'Stop at the depot',
    stopInFinish: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: POSITION,
  intro: ['x grows to the right, y grows upwards (cm)', 'Facing right: move_forward(x1 − robot.x()) reaches the right x', 'Turn left to face up: move_forward(y1 − robot.y())'],
  hints: [
    'A negative distance makes the robot drive backwards — so “target − position” works whichever side the target is on.',
    'face right → drive x1 − x → turn left (face up) → drive y1 − y → turn right → drive x2 − x → turn left → drive y2 − y → back to the depot the same way.',
    'robot.move_forward(mission.x1 - robot.x())\nrobot.turn_left(90)\nrobot.move_forward(mission.y1 - robot.y())\nrobot.turn_right(90)\n… point 2 the same way …\nrobot.move_forward(-240 - robot.x())\nrobot.turn_left(90)\nrobot.move_forward(-140 - robot.y())',
    'robot.move_forward(mission.x1 - robot.x())\nrobot.turn_left(90)\nrobot.move_forward(mission.y1 - robot.y())\nrobot.turn_right(90)\nrobot.move_forward(mission.x2 - robot.x())\nrobot.turn_left(90)\nrobot.move_forward(mission.y2 - robot.y())\nrobot.turn_right(90)\nrobot.move_forward(-240 - robot.x())\nrobot.turn_left(90)\nrobot.move_forward(-140 - robot.y())',
  ],
  stars,
  rewards: { xp: 190 },
  briefing: {
    story: 'The canyon outposts rebuilt their parcel network. Each morning they send the drop points as map coordinates — the robot has a GPS and can work out every distance itself.',
    task: 'Drive to parcel point 1, then point 2, then back to the depot at (−240, −140), and stop.',
    objectives: { primary: 'Visit both parcel points and stop at the depot', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Coordinates', 'Position sensors', 'Subtraction', 'Negative distances'],
    python: ['robot.x()', 'robot.y()', 'robot.move_forward(mission.x1 - robot.x())'],
    predict: 'The robot is at x = −240 and point 1 is at x = −60. How far must it drive? And if the point were at x = −300?',
    pseudocode: ['drive x1 − x (facing right)', 'turn to face up, drive y1 − y', 'the same for point 2', 'the same back to the depot'],
    minutes: 14,
    tier: 'hard',
    mechanics: ['coordinates', 'data', 'variants'],
  },
};
