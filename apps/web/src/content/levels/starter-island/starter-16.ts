import type { MapEntity } from '@robolab/shared';
import { checkpoint, levelMap, rect, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { VARIABLES, laneWithBays } from './kit';

/*
 * Mission 1-16 · Emergency Dispatcher — four rescue stations line the
 * street. Each run, dispatch radios which one needs the medical kit
 * (`mission.target`, 1–4). The robot drives to that station, delivers into
 * its bay, and returns to the dispatch pad. The other bays are busy (no-go).
 *
 * Teaches: mission parameters, multiplication, Python first.
 */

const LANE = 0.6;
const START = { x: -2.4, z: LANE, heading: 0 };
const STATION_X = (n: number) => START.x + n * 0.8;
const BAY_Z = LANE - 0.6;

const busy = (n: number): MapEntity => zone(`busy-${n}`, 'hazard', rect(STATION_X(n), BAY_Z - 0.1, 0.5, 0.45), { label: 'BUSY' });

function layout(target: number): LevelVariant {
  return {
    id: `station-${target}`,
    remove: ['cp-1', 'busy-1', 'busy-2', 'busy-3', 'busy-4'],
    add: [checkpoint(1, STATION_X(target), BAY_Z, 0.18), ...[1, 2, 3, 4].filter((n) => n !== target).map(busy)],
    data: { target },
  };
}

const map = levelMap({
  id: 'starter-16',
  name: 'Emergency Dispatcher',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: rect(START.x, LANE, 0.5, 0.5),
  entities: [
    checkpoint(1, STATION_X(1), BAY_Z, 0.18),
    busy(2),
    busy(3),
    busy(4),
    ...laneWithBays('rail', LANE, -2.95, 1.5, [1, 2, 3, 4].map((n) => ({ x: STATION_X(n), side: -1 as const, depth: 0.8 }))),
  ],
});

const stars = { parBlocks: 10, parSeconds: 34 };

export const STARTER_16: LevelDefinition = {
  id: 'starter-16',
  world: 'starter-island',
  number: 16,
  title: 'Emergency Dispatcher',
  description: 'Dispatch radios which of four rescue stations needs the medical kit (mission.target). Deliver it into that bay and return to the dispatch pad.',
  difficulty: 4,
  map,
  data: { target: 1 },
  variants: [layout(1), layout(2), layout(3), layout(4)],
  editor: 'python',
  environmentId: 'starter-signal-crossing',
  scene: { path: [{ x: -2.9, z: LANE }, { x: 1.4, z: LANE }], pathWidth: 0.84 },
  mission: standardMission('starter-16', map, {
    title: 'Emergency Dispatcher',
    description: 'Deliver to the station dispatch names, then stop back on the dispatch pad.',
    checkpointLabels: ['Deliver to the target station'],
    goalLabel: 'Stop on the dispatch pad',
    stopInFinish: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: VARIABLES,
  intro: ['Station n is n × 80 cm along the street', 'Turn into its bay, deliver, back out', 'Drive back to the dispatch pad and stop'],
  hints: [
    'The stations are 80 cm apart: station 3 is 3 × 80 cm from the pad. Store that distance in a variable — the way back is the same distance.',
    'd = mission.target × 80 → drive d → turn left → into the bay and back out → turn right → drive back d.',
    'd = mission.target * 80\nrobot.move_forward(d)\nrobot.turn_left(90)\nrobot.move_forward(60)\nrobot.move_backward(60)\nrobot.turn_right(90)\nrobot.move_backward(?)',
    'd = mission.target * 80\nrobot.move_forward(d)\nrobot.turn_left(90)\nrobot.move_forward(60)\nrobot.move_backward(60)\nrobot.turn_right(90)\nrobot.move_backward(d)',
  ],
  stars,
  rewards: { xp: 170 },
  briefing: {
    story: 'The island’s emergency line is ringing. Four rescue stations share one delivery robot, and dispatch decides on every call which station needs the medical kit.',
    task: 'Read mission.target, deliver into that station’s bay and return to the dispatch pad.',
    objectives: { primary: 'Deliver to the right station and stop on the dispatch pad', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Mission parameters', 'Variables', 'Multiplication', 'Python'],
    python: ['d = mission.target * 80', 'robot.move_forward(d)', 'robot.move_backward(d)'],
    predict: 'If mission.target is 4, how far does the robot drive along the street — and how far back?',
    pseudocode: ['d = target × 80', 'drive d', 'turn into the bay, deliver, back out', 'drive back d to the pad'],
    minutes: 12,
    tier: 'hard',
    mechanics: ['data', 'variants', 'hazard'],
  },
};
