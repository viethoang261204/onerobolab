import { checkpoint, corridorWalls, levelMap, traceRoute, wall } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';

/*
 * Mission 1-2 · Power Station — the island's power yard is dark. Drive the
 * service lanes past two transformers (inspection waypoints) and park on the
 * charging pad so the station can reboot. Three corners, both directions.
 *
 * Teaches: route planning, waypoints, left AND right turns, stop in a zone.
 */

const START = { x: -2.4, z: 1.3, heading: 0 };
/** 2 steps east (1.2 m), left, 2 steps north (1.2 m), right, 3 steps east (1.8 m), right, 1 step south (0.6 m). */
const route = traceRoute(START, [1.2, 'L', 1.2, 'R', 1.8, 'R', 0.6]);
const pad = route.end;
/** The station's service door, 0.95 m past the pad. */
const DOOR_Z = pad.z + 0.95;

const map = levelMap({
  id: 'starter-02',
  name: 'Power Station',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: { shape: 'rect', center: { x: pad.x, z: pad.z }, size: { x: 0.5, z: 0.5 }, rotation: 0 },
  entities: [
    // Inspection waypoints at the two transformers.
    checkpoint(1, route.points[1]!.x, 0.7),
    checkpoint(2, -0.4, route.points[2]!.z),
    ...corridorWalls('hedge', [...route.points.slice(0, 4), { x: pad.x, z: DOOR_Z }], 0.42, { extendStart: 0.35, height: 0.18, thickness: 0.14 }),
    wall('dock-station', { x: pad.x - 0.42, z: DOOR_Z }, { x: pad.x + 0.42, z: DOOR_Z }, 0.5, 0.1),
  ],
});

const stars = { parBlocks: 8, parSeconds: 26 };

export const STARTER_02: LevelDefinition = {
  id: 'starter-02',
  world: 'starter-island',
  number: 2,
  title: 'Power Station',
  description: 'The power yard is dark. Inspect both transformers on the service lanes and park on the charging pad so the station can reboot.',
  difficulty: 1,
  map,
  environmentId: 'starter-campus-crossing',
  scene: { path: [{ x: START.x - 0.35, z: START.z }, ...route.points.slice(1, 4), { x: pad.x, z: DOOR_Z - 0.05 }], pathWidth: 0.72 },
  mission: standardMission('starter-02', map, {
    title: 'Power Station',
    description: 'Inspect both transformers and stop on the charging pad.',
    checkpointLabels: ['Inspect transformer A', 'Inspect transformer B'],
    goalLabel: 'Stop on the charging pad',
    stopInFinish: true,
    scoring: scoringFor(stars),
  }),
  allowedBlocks: ['event.start', 'motion.step', 'motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop'],
  intro: ['Plan the whole route in grid steps (2, L, 2, R, 3, R, 1)', 'Pass both transformers', 'Stop on the charging pad'],
  hints: [
    'Use the top camera to see the whole yard. Write the route down before you code it: which way is each corner — left or right?',
    'step 2 → turn left → step 2 → turn right → step 3 → turn right → step 1 → stop.',
    'step 2 → turn left 90 → step 2 → turn right 90 → step ? → turn right 90 → step ? → stop.',
    'step 2 → turn left 90 → step 2 → turn right 90 → step 3 → turn right 90 → step 1 → stop.',
  ],
  stars,
  rewards: { xp: 75 },
  briefing: {
    story: 'With spare parts delivered, the next job is power. Starter Island’s power yard went dark in the storm. The transformers must be inspected and the station needs a robot docked on its charging pad to restart.',
    task: 'Drive the service lanes past both transformers and stop on the charging pad.',
    objectives: {
      primary: 'Inspect both transformers and stop on the charging pad without hitting anything',
      secondary: `Reach the pad within ${stars.parSeconds} seconds`,
      optional: `Use ${stars.parBlocks} blocks or fewer`,
    },
    concepts: ['Route planning', 'Grid steps', 'Left and right turns', 'Sequence'],
    python: ['robot.step(n)', 'robot.turn_left(90)', 'robot.turn_right(90)', 'robot.stop()'],
    predict: 'Look at the yard from above. How many corners are there, and which ones turn left and which turn right?',
    pseudocode: ['drive to the first corner', 'turn left', 'drive past transformer A', 'turn right', 'drive past transformer B', 'turn right', 'drive onto the charging pad', 'stop'],
    minutes: 6,
    tier: 'easy',
    mechanics: [],
  },
};
