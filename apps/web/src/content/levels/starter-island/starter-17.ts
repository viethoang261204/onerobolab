import { cargoStack, levelMap, rect, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { LOOPS, laneWithBays } from './kit';

/*
 * Mission 1-17 · Rescue Collector — survivor pods drifted into the bays of
 * the rescue depot: bay 1 is 70 cm from base, bay 2 140 cm, … Each run there
 * are `mission.count` pods (in the first bays). Collect them one by one and
 * bring each back to the base drop zone. The distance grows each trip: a
 * counter variable inside a loop.
 *
 * Teaches: collect-and-return loops, a counter variable, `while` / `for`.
 */

const LANE = 0.6;
const START = { x: -2.4, z: LANE, heading: 0 };
const BAY_X = (k: number) => START.x + 0.7 * k;
const POD_Z = 0.0;
const BAYS = [1, 2, 3, 4];

const pods = (count: number) => BAYS.filter((k) => k <= count).map((k) => cargoStack(`pod-${k}`, BAY_X(k), POD_Z, [null]));
const layout = (count: number): LevelVariant => ({ id: `pods-${count}`, remove: BAYS.map((k) => `pod-${k}`), add: pods(count), data: { count } });

const map = levelMap({
  id: 'starter-17',
  name: 'Rescue Collector',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: rect(START.x, LANE, 0.4, 0.4),
  entities: [
    ...pods(3),
    zone('base-drop', 'delivery', rect(START.x, LANE + 0.27, 0.4, 0.26), { label: 'BASE' }),
    ...laneWithBays('rail', LANE, -2.95, 0.9, BAYS.map((k) => ({ x: BAY_X(k), side: -1 as const, depth: 0.85 }))),
  ],
});

const stars = { parBlocks: 18, parSeconds: 120 };

export const STARTER_17: LevelDefinition = {
  id: 'starter-17',
  world: 'starter-island',
  number: 17,
  title: 'Rescue Collector',
  description: 'Survivor pods drifted into the depot bays — mission.count of them, 70 cm apart. Collect each one and bring it back to base. Every trip is 70 cm longer.',
  difficulty: 4,
  map,
  data: { count: 3 },
  variants: [layout(2), layout(3), layout(4)],
  editor: 'python',
  environmentId: 'starter-rescue-depot',
  scene: { path: [{ x: -2.9, z: LANE }, { x: 0.8, z: LANE }], pathWidth: 0.84 },
  mission: standardMission('starter-17', map, {
    title: 'Rescue Collector',
    description: 'Bring every survivor pod back to the base drop zone.',
    tasks: [{ id: 'rescue', type: 'deliverCargo', count: 0, label: 'Bring every pod to base' }],
    noGoal: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: LOOPS,
  intro: ['Pod k is k × 70 cm from base', 'Fetch it: drive, turn in, pick up, back out, drive back', 'Drop it at base (turn right), then fetch the next one'],
  hints: [
    'Every trip is the same except the distance: 70, 140, 210 … cm. Keep the pod number in a variable and add 1 after each trip.',
    'k = 1 → repeat mission.count times { drive k × 70 → turn in, pick up, back out → drive back → turn to the drop zone, drop, turn back → k = k + 1 }.',
    'k = 1\nfor _ in range(mission.count):\n    robot.move_forward(k * 70)\n    robot.turn_left(90)\n    robot.move_forward(30)\n    robot.pick_up()\n    robot.move_backward(30)\n    robot.turn_right(90)\n    robot.move_backward(k * 70)\n    … drop at base …\n    k += 1',
    'k = 1\nfor _ in range(mission.count):\n    robot.move_forward(k * 70)\n    robot.turn_left(90)\n    robot.move_forward(30)\n    robot.pick_up()\n    robot.move_backward(30)\n    robot.turn_right(90)\n    robot.move_backward(k * 70)\n    robot.turn_right(90)\n    robot.drop()\n    robot.turn_left(90)\n    k += 1',
  ],
  stars,
  rewards: { xp: 180 },
  briefing: {
    story: 'The storm surge washed survivor pods into the rescue depot. Each one has to be brought back to base — and how many there are changes with every call.',
    task: 'Collect every survivor pod and drop it in the base zone.',
    objectives: { primary: 'Bring every pod to the base drop zone', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Counter variables', 'for / while', 'Collect and return', 'Mission data'],
    python: ['for _ in range(mission.count):', 'k += 1', 'robot.move_forward(k * 70)'],
    predict: 'On the third trip, how far is the pod from base? What changes from one trip to the next — and what stays the same?',
    pseudocode: ['k = 1', 'repeat count times:', '    drive k × 70, fetch the pod, drive back', '    drop it at base', '    k = k + 1'],
    minutes: 14,
    tier: 'hard',
    mechanics: ['pickup', 'data', 'variants'],
  },
};
