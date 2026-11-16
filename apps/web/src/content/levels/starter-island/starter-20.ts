import type { MapEntity } from '@robolab/shared';
import { checkpoint, goalArea, levelMap, rect, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { LOOPS, laneWithBays } from './kit';

/*
 * Mission 1-20 · Storm Evacuation — three villages along the gorge road.
 * The weather office sends a record for each: flood risk (1–9) and people
 * still there. Evacuate a village only if its risk is above 5 AND people
 * are there; the others shelter in place and must not be disturbed.
 *
 * Teaches: data records, compound conditions (and).
 */

const LANE = 0.6;
const START = { x: -2.6, z: LANE, heading: 0 };
const VILLAGES = [
  { key: 'a', x: -1.6 },
  { key: 'b', x: -0.4 },
  { key: 'c', x: 0.8 },
] as const;
const BAY_Z = LANE - 0.6;

type Record3 = readonly [risk: number, people: number];

function layout(id: string, records: readonly [Record3, Record3, Record3]): LevelVariant {
  const add: MapEntity[] = [];
  const data: Record<string, number> = {};
  let n = 0;
  VILLAGES.forEach((v, i) => {
    const [risk, people] = records[i]!;
    data[`risk_${v.key}`] = risk;
    data[`people_${v.key}`] = people;
    if (risk > 5 && people > 0) add.push(checkpoint(++n, v.x, BAY_Z, 0.18));
    else add.push(zone(`shelter-${v.key}`, 'hazard', rect(v.x, BAY_Z - 0.05, 0.5, 0.45), { label: 'SHELTERING' }));
  });
  return { id, remove: ['cp-1', 'cp-2', 'cp-3', ...VILLAGES.map((v) => `shelter-${v.key}`)], add, data };
}

const VARIANTS = [
  layout('a', [[7, 12], [3, 20], [8, 0]]),
  layout('b', [[4, 5], [9, 3], [6, 8]]),
  layout('c', [[8, 2], [6, 0], [9, 15]]),
  layout('d', [[2, 30], [5, 10], [7, 4]]),
];
const base = VARIANTS[0]!;

const map = levelMap({
  id: 'starter-20',
  name: 'Storm Evacuation',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: goalArea(2.05, LANE, 0.5),
  entities: [...(base.add ?? []), ...laneWithBays('rail', LANE, -2.95, 2.4, VILLAGES.map((v) => ({ x: v.x, side: -1 as const, depth: 0.8 })))],
});

const stars = { parBlocks: 34, parSeconds: 60 };

export const STARTER_20: LevelDefinition = {
  id: 'starter-20',
  world: 'starter-island',
  number: 20,
  title: 'Storm Evacuation',
  description: 'Each village sends a record: flood risk and people still there. Evacuate only villages with risk above 5 AND people present, then reach the shelter.',
  difficulty: 5,
  map,
  data: base.data!,
  variants: VARIANTS,
  editor: 'python',
  environmentId: 'starter-gorge-run',
  scene: { path: [{ x: -2.9, z: LANE }, { x: 2.3, z: LANE }], pathWidth: 0.84 },
  mission: standardMission('starter-20', map, {
    title: 'Storm Evacuation',
    description: 'Evacuate every village at risk, leave the others in peace, reach the shelter.',
    checkpoints: 'all',
    allCheckpointsLabel: 'Evacuate every village at risk',
    goalLabel: 'Reach the storm shelter',
    scoring: scoringFor(stars),
  }),
  allowedBlocks: LOOPS,
  intro: ['Villages A, B, C are 100, 220 and 340 cm along the road', 'Evacuate if risk > 5 and people > 0', 'Never enter a village that shelters in place'],
  hints: [
    'Each village needs the same test with its own numbers: mission.risk_a and mission.people_a for A, and so on. Both parts must be true — “and”.',
    'drive to A → if risk_a > 5 and people_a > 0 → (into the village and back out) → drive to B → same test → drive to C → same test → drive to the shelter.',
    'robot.move_forward(100)\nif mission.risk_a > 5 and mission.people_a > 0:\n    robot.turn_left(90)\n    robot.move_forward(60)\n    robot.move_backward(60)\n    robot.turn_right(90)\nrobot.move_forward(120)\n… B and C the same …\nrobot.move_forward(?)',
    'robot.move_forward(100)\nif mission.risk_a > 5 and mission.people_a > 0:\n    (in and out of the village)\nrobot.move_forward(120)\nif mission.risk_b > 5 and mission.people_b > 0:\n    (in and out)\nrobot.move_forward(120)\nif mission.risk_c > 5 and mission.people_c > 0:\n    (in and out)\nrobot.move_forward(125)   — “in and out” = turn_left(90), move_forward(60), move_backward(60), turn_right(90)',
  ],
  stars,
  rewards: { xp: 190 },
  briefing: {
    story: 'A second storm is coming up the gorge. The weather office has a record for every village: the flood risk and how many people are still there. Rescue robots only go where they are really needed.',
    task: 'Evacuate the villages with risk above 5 and people present, then reach the storm shelter.',
    objectives: { primary: 'Evacuate exactly the villages at risk and reach the shelter', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Data records', 'Compound conditions', 'and', 'Comparisons'],
    python: ['if mission.risk_a > 5 and mission.people_a > 0:', 'robot.move_forward(cm)'],
    predict: 'A village has risk 5 and 10 people. Is it evacuated? And one with risk 8 and 0 people?',
    pseudocode: ['for each village in turn:', '    drive to it', '    if risk > 5 and people > 0: go in and out', 'drive to the shelter'],
    minutes: 14,
    tier: 'hard',
    mechanics: ['data', 'variants', 'hazard'],
  },
};
