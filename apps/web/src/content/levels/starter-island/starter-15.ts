import { checkpoint, gate, levelMap, rect, wall } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition, LevelVariant } from '../types';
import { VARIABLES } from './kit';

/*
 * Mission 1-15 · Bridge Engineer — the long steel bridge has one damaged
 * plank, a different one every run. The control room radios how many 40 cm
 * segments after the bridge head it is (`mission.segments`). The robot drives
 * exactly there and waits so the repair crane can work (the gate behind it
 * opens), then drives on to the tower and stops on its pad.
 *
 * Teaches: variables, arithmetic, mission data — Blocks ⇄ Python side by side.
 */

const LANE = 0;
const START = { x: -2.6, z: LANE, heading: 0 };
/** The bridge head is 60 cm from the start; segments are 40 cm. */
const repairX = (segments: number) => START.x + 0.6 + segments * 0.4;
const TOWER = 1.6;

function layout(segments: number): LevelVariant {
  const x = repairX(segments);
  return {
    id: `segments-${segments}`,
    remove: ['cp-1', 'gate'],
    add: [checkpoint(1, x, LANE, 0.15), gate('gate', { x: 1.0, z: LANE - 0.42 }, { x: 1.0, z: LANE + 0.42 }, rect(x, LANE, 0.3, 0.6), 1.5)],
    data: { segments },
  };
}

const map = levelMap({
  id: 'starter-15',
  name: 'Bridge Engineer',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: rect(TOWER, LANE, 0.4, 0.5),
  entities: [
    checkpoint(1, repairX(3), LANE, 0.15),
    gate('gate', { x: 1.0, z: LANE - 0.42 }, { x: 1.0, z: LANE + 0.42 }, rect(repairX(3), LANE, 0.3, 0.6), 1.5),
    wall('rail-north', { x: -2.95, z: LANE - 0.42 }, { x: 2.0, z: LANE - 0.42 }),
    wall('rail-south', { x: -2.95, z: LANE + 0.42 }, { x: 2.0, z: LANE + 0.42 }),
    wall('rail-west', { x: -2.95, z: LANE - 0.42 }, { x: -2.95, z: LANE + 0.42 }),
    wall('dock-tower', { x: 2.0, z: LANE - 0.42 }, { x: 2.0, z: LANE + 0.42 }, 0.5, 0.1),
  ],
});

const stars = { parBlocks: 10, parSeconds: 26 };

export const STARTER_15: LevelDefinition = {
  id: 'starter-15',
  world: 'starter-island',
  number: 15,
  title: 'Bridge Engineer',
  description: 'One plank of the long bridge is damaged — a different one every run. Compute where it is from mission.segments, wait there for the crane, then reach the tower.',
  difficulty: 4,
  map,
  data: { segments: 3 },
  variants: [layout(3), layout(4), layout(5), layout(6)],
  editor: 'split',
  environmentId: 'starter-facility-yard',
  scene: {
    path: [{ x: -2.95, z: LANE }, { x: 1.95, z: LANE }],
    pathWidth: 0.84,
    bridges: [{ from: { x: -1.6, z: LANE }, to: { x: 1.1, z: LANE }, width: 0.84, style: 'steel' }],
    water: [{ points: [{ x: -0.25, z: -2.6 }, { x: -0.25, z: 2.6 }], width: 2.2, depth: 0.6 }],
  },
  mission: standardMission('starter-15', map, {
    title: 'Bridge Engineer',
    description: 'Stop at the damaged plank until the crane is done, then stop on the tower pad.',
    checkpointLabels: ['Reach the damaged plank'],
    goalLabel: 'Stop on the tower pad',
    stopInFinish: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: VARIABLES,
  intro: ['mission.segments says how many 40 cm segments after the bridge head (60 cm away)', 'Stop there and wait for the crane', 'Then drive the rest of the 420 cm to the tower'],
  hints: [
    'Distance to the plank = 60 + segments × 40. Keep it in a variable — you need it twice.',
    'set d to (mission.segments × 40 + 60) → move forward d → wait → move forward (420 − d).',
    'set d to ((mission segments × 40) + 60) → move forward (d) → wait 2 → move forward (? − d).',
    'set d to ((mission segments × 40) + 60) → move forward (d) → wait 2 → move forward (420 − d).',
  ],
  stars,
  rewards: { xp: 170 },
  briefing: {
    story: 'The long steel bridge to the robot facility survived the storm — almost. Every night the inspectors find a different damaged plank, and the control room radios its position to the repair robot.',
    task: 'Compute where the damaged plank is, wait there until the crane has repaired it, then stop on the tower pad.',
    objectives: { primary: 'Wait at the damaged plank, then stop on the tower pad', secondary: `Finish within ${stars.parSeconds} seconds`, optional: `Use ${stars.parBlocks} blocks or fewer` },
    concepts: ['Variables', 'Arithmetic', 'Mission data', 'Blocks ⇄ Python'],
    python: ['d = mission.segments * 40 + 60', 'robot.move_forward(d)', 'robot.move_forward(420 - d)'],
    predict: 'If mission.segments is 5, how far is the plank? And how far is it from there to the tower (420 cm from the start)?',
    pseudocode: ['d = segments × 40 + 60', 'drive d', 'wait for the crane', 'drive 420 − d'],
    minutes: 12,
    tier: 'hard',
    mechanics: ['data', 'variants', 'gate'],
  },
};
