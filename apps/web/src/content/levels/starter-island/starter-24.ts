import type { MapEntity } from '@robolab/shared';
import { cargoStack, levelMap, mover, rect, trafficLight, wall, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { EVERYTHING } from './kit';

/*
 * Mission 1-24 · Arena — Smart Island Rescue (final boss, Python only).
 * Rescue City at rush hour: patrol carts cross the avenue on their own
 * timetables (different every run), a survivor waits at the end of the
 * avenue, and the hospital is up Hospital Street, past a traffic light.
 * The clock is running. Watch each cart pass in front of the robot, then
 * cross behind it; carry the survivor to the hospital. Bonus: rescue the
 * second survivor too, and be quick.
 *
 * Teaches: autonomous behaviour with dynamic obstacles, time pressure,
 * everything the island taught.
 */

const AVENUE = 1.6;
const STREET_B = 1.6; // x of Hospital Street
const H = 0.42;
const START = { x: -2.6, z: AVENUE, heading: 0 };
const TRACKS = [-1.0, 0.6];
const GAP = 0.16;

/** Avenue walls with openings where the carts cross, and Hospital Street. */
function walls(): MapEntity[] {
  const out: MapEntity[] = [];
  const split = (id: string, z: number, x0: number, x1: number) => {
    let from = x0;
    TRACKS.forEach((t, i) => {
      out.push(wall(`rail-${id}${i}`, { x: from, z }, { x: t - GAP, z }, 0.18));
      from = t + GAP;
    });
    out.push(wall(`rail-${id}${TRACKS.length}`, { x: from, z }, { x: x1, z }, 0.18));
  };
  split('n', AVENUE - H, -2.95, STREET_B - H);
  split('s', AVENUE + H, -2.95, 2.5);
  out.push(wall('rail-west', { x: -2.95, z: AVENUE - H }, { x: -2.95, z: AVENUE + H }, 0.18));
  out.push(wall('rail-east', { x: 2.5, z: AVENUE - H }, { x: 2.5, z: AVENUE + H }, 0.18));
  out.push(wall('rail-bw', { x: STREET_B - H, z: AVENUE - H }, { x: STREET_B - H, z: -1.95 }, 0.18));
  out.push(wall('rail-be', { x: STREET_B + H, z: AVENUE - H }, { x: STREET_B + H, z: -1.95 }, 0.18));
  out.push(wall('dock-hospital', { x: STREET_B - H, z: -1.95 }, { x: STREET_B + H, z: -1.95 }, 0.5, 0.1));
  return out;
}

const carts = (p1: number, o1: number, p2: number, o2: number): MapEntity[] => [
  mover('cart-1', { x: TRACKS[0]!, z: 0.7 }, { x: TRACKS[0]!, z: 2.4 }, p1, o1),
  mover('cart-2', { x: TRACKS[1]!, z: 0.7 }, { x: TRACKS[1]!, z: 2.4 }, p2, o2),
];
const rush = (id: string, p1: number, o1: number, p2: number, o2: number): LevelVariant => ({ id, remove: ['cart-1', 'cart-2'], add: carts(p1, o1, p2, o2) });

const map = levelMap({
  id: 'starter-24',
  name: 'Rescue City Arena',
  size: { x: 6.2, z: 5 },
  start: START,
  finish: rect(STREET_B, -1.25, 0.6, 0.5),
  entities: [
    ...carts(8, 6.92, 9, 4.985),
    cargoStack('survivors', 2.15, AVENUE, [null, null]),
    zone('hospital', 'delivery', rect(STREET_B, -1.5, 0.5, 0.4), { label: 'HOSPITAL' }),
    trafficLight('light', { position: { x: 2.2, z: 0.45 }, facing: -Math.PI / 2, crossing: rect(STREET_B, 0.2, 0.84, 0.3), signal: rect(STREET_B, 0.425, 0.3, 0.15), red: 5, green: 5, yellow: 2, offset: 3 }),
    ...walls(),
  ],
});

const stars = { parBlocks: 24, parSeconds: 60 };

export const STARTER_24: LevelDefinition = {
  id: 'starter-24',
  world: 'starter-island',
  number: 24,
  title: 'Smart Island Rescue',
  description: 'The Arena: patrol carts cross the avenue on changing timetables. Get past them safely, carry the survivor up Hospital Street on green — against the clock.',
  difficulty: 5,
  map,
  // Timetables: a robot that just drives through meets cart 1 on the avenue.
  variants: [rush('rush-a', 8, 6.92, 9, 4.985), rush('rush-b', 7, 5.655, 8, 3.72), rush('rush-c', 9, 8.185, 7, 2.455)],
  editor: 'python',
  environmentId: 'starter-rescue-city',
  scene: { path: [{ x: -2.9, z: AVENUE }, { x: STREET_B, z: AVENUE }, { x: 2.4, z: AVENUE }, { x: STREET_B, z: AVENUE }, { x: STREET_B, z: -1.9 }], pathWidth: 0.84 },
  mission: standardMission('starter-24', map, {
    title: 'Smart Island Rescue',
    description: 'Carry a survivor to the hospital before time runs out.',
    tasks: [{ id: 'rescue', type: 'deliverCargo', count: 1, label: 'Bring a survivor to the hospital' }],
    goalLabel: 'Reach the hospital entrance',
    timeLimit: 180,
    bonus: [
      { id: 'second', type: 'deliverCargo', count: 2, label: 'Bonus: rescue both survivors' },
      { id: 'fast', type: 'finishWithin', seconds: 60, label: 'Bonus: finish within 60 s' },
    ],
    scoring: scoringFor(stars, 150),
  }),
  allowedBlocks: EVERYTHING,
  intro: ['Stop before each cart track and watch it pass in front of you', 'Then cross at full speed behind it', 'Survivor at the end of the avenue → hospital, on green'],
  hints: [
    'A cart is dangerous when it comes from the side — the sensor can’t see it there. Wait until it has passed in FRONT of the robot: then you know where it is and how long it needs to come back.',
    'drive to the line before track 1 → wait while nothing is in front → wait while the cart is in front → cross at full speed → the same for track 2 → pick up the survivor → Hospital Street → wait for green → drive to the hospital and drop.',
    'robot.set_speed(100)\nrobot.move_forward(115)\nwhile robot.distance() > 50:\n    robot.wait(0.1)\nwhile robot.distance() < 50:\n    robot.wait(0.1)\nrobot.move_forward(160)\n… track 2 the same, then forward 170 …',
    'robot.set_speed(100) · forward 115 · (wait while distance > 50, wait while distance < 50) · forward 160 · (the same two waits) · forward 170 · pick_up · backward 25 · turn_left 90 · forward 110 · while robot.color() != "green": wait(0.1) · forward 175 · drop',
  ],
  stars,
  rewards: { xp: 300 },
  briefing: {
    story: 'The island is repaired — now the Arena tests whether its robots can work on their own. Rescue City at rush hour: carts on every crossing, a survivor waiting, the hospital up the street and the clock running.',
    task: 'Get past the patrol carts safely, pick up the survivor and drop them at the hospital before time runs out.',
    objectives: { primary: 'Deliver a survivor to the hospital within 180 s, without a crash', secondary: 'Bonus: finish within 60 s', optional: 'Bonus: rescue both survivors' },
    concepts: ['Dynamic obstacles', 'Autonomous behaviour', 'Time pressure', 'Everything together'],
    python: ['while robot.distance() > 50:', 'robot.wait(0.1)', 'robot.pick_up()', 'while robot.color() != "green":'],
    predict: 'A cart crosses the avenue every 8 seconds. When is the safest moment to cross its track — and how can the robot know that moment has come?',
    pseudocode: ['for each cart track:', '    stop before it', '    wait until the cart passes in front', '    wait until it has gone', '    cross at full speed', 'pick up the survivor', 'Hospital Street: wait for green', 'drive to the hospital, drop'],
    minutes: 20,
    tier: 'boss',
    mechanics: ['movers', 'pickup', 'traffic', 'variants'],
  },
};
