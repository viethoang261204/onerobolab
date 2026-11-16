import { entityId } from '@robolab/shared';
import { cargoStack, checkpoint, goalArea, levelMap, rect, supplyCrate, trafficLight, wall, zone } from '../../environments/level-map';
import { scoringFor, standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';
import { EVERYTHING } from './kit';

/*
 * Mission 1-23 · Island Recovery (boss) — the last repairs before the Arena,
 * all in one program: push the bridge block onto the building site, carry
 * both generator parts to the power depot (around the flood), wait for the
 * traffic light, and reach the control tower. Bonus: visit the energy core
 * and finish fast. Many routes work — `go to x, y` helps.
 *
 * Teaches: combining every system, planning, optimisation, bonus goals.
 */

const START = { x: -2.4, z: 1.4, heading: 0 };
const TOWER = { x: 2.3, z: -0.65 };

const map = levelMap({
  id: 'starter-23',
  name: 'Island Recovery',
  size: { x: 6, z: 4.4 },
  start: START,
  finish: goalArea(TOWER.x, TOWER.z),
  entities: [
    zone('site', 'construction', rect(-1.4, -0.2, 0.6, 0.6), { label: 'BRIDGE SITE' }),
    supplyCrate('block-1', -1.4, 0.95),
    zone('flood', 'hazard', rect(-0.7, 0.4, 0.5, 0.9), { color: 'blue', label: 'FLOOD' }),
    cargoStack('parts', 0.4, 1.4, [null, null]),
    zone('depot', 'delivery', rect(0, -0.9, 0.5, 0.5), { label: 'POWER DEPOT' }),
    trafficLight('light', { position: { x: 1.0, z: -1.25 }, facing: Math.PI, crossing: rect(1.2, TOWER.z, 0.3, 0.84), signal: rect(0.85, TOWER.z, 0.15, 0.3), red: 6, green: 6, yellow: 2 }),
    checkpoint(9, 2.3, 1.4, 0.2),
    wall('fence-north', { x: -2.9, z: -1.8 }, { x: 2.9, z: -1.8 }),
    wall('fence-south', { x: -2.9, z: 1.85 }, { x: 2.9, z: 1.85 }),
    wall('fence-west', { x: -2.9, z: -1.8 }, { x: -2.9, z: 1.85 }),
    wall('fence-east', { x: 2.9, z: -1.8 }, { x: 2.9, z: 1.85 }),
  ],
});

const stars = { parBlocks: 22, parSeconds: 75 };

export const STARTER_23: LevelDefinition = {
  id: 'starter-23',
  world: 'starter-island',
  number: 23,
  title: 'Island Recovery',
  description: 'All repairs at once: push the bridge block onto the site, carry both generator parts to the depot, wait for the light, reach the control tower.',
  difficulty: 5,
  map,
  editor: 'python',
  environmentId: 'starter-guide-line',
  scene: { path: [{ x: -2.7, z: 1.4 }, { x: 0.0, z: 1.4 }, { x: 0.0, z: TOWER.z }, { x: 2.6, z: TOWER.z }], pathWidth: 0.7 },
  mission: standardMission('starter-23', map, {
    title: 'Island Recovery',
    description: 'Finish every repair and reach the control tower.',
    tasks: [
      { id: 'build', type: 'pushToZone', zoneId: entityId('site'), count: 1, label: 'Push the bridge block onto the site' },
      { id: 'power', type: 'deliverCargo', count: 2, label: 'Deliver 2 generator parts' },
    ],
    goalLabel: 'Reach the control tower',
    bonus: [
      { id: 'cp-9', type: 'reachCheckpoint', checkpointId: entityId('cp-9'), label: 'Bonus: visit the energy core' },
      { id: 'fast', type: 'finishWithin', seconds: 75, label: 'Bonus: finish within 75 s' },
    ],
    scoring: scoringFor(stars, 150),
  }),
  allowedBlocks: EVERYTHING,
  intro: ['Push the block north onto the bridge site', 'Carry both parts from the shelf to the power depot — never through the flood', 'Wait for green, then the control tower'],
  hints: [
    'Split the job into parts and solve one at a time. robot.go_to(x, y) drives straight to a point — handy to get round the map (y is up, in cm).',
    'push the block (forward 100, turn left, forward 140, back 140) → drive east to the shelf → twice: pick up, carry north to the depot, drop, come back → go to the stop line → wait until green → drive to the tower.',
    'The shelf is 140 cm east of the block lane, the depot 205 cm north of the shelf lane, the stop line is at (78, 65). Wait for green — yellow is too late to start: while robot.color() != "green": robot.wait(0.1)',
    'forward 100 · left 90 · forward 140 · backward 140 · right 90 · forward 140 · pick_up · left 90 · forward 205 · drop · backward 205 · right 90 · pick_up · left 90 · forward 205 · drop · go_to(78, 65) · while robot.color() != "green": wait(0.1) · forward 152',
  ],
  stars,
  rewards: { xp: 220 },
  briefing: {
    story: 'One day before the Arena: the island council wants every system back at once — the bridge, the power depot and the traffic lights — before the control tower can declare the island recovered.',
    task: 'Push the bridge block onto the site, deliver both generator parts, obey the traffic light and reach the control tower.',
    objectives: { primary: 'Finish all repairs and reach the control tower', secondary: `Finish within ${stars.parSeconds} seconds (bonus)`, optional: 'Visit the energy core (bonus)' },
    concepts: ['Combining systems', 'Planning', 'go to x, y', 'Bonus objectives'],
    python: ['robot.go_to(x, y)', 'while robot.color() != "green":', 'robot.pick_up()'],
    predict: 'Which part of the job would you do first, and why? Is there a route that also passes the energy core without wasting time?',
    pseudocode: ['push the block onto the site', 'repeat 2: fetch a part, carry it to the depot', 'go to the stop line', 'wait until the light is green', 'drive to the control tower'],
    minutes: 18,
    tier: 'boss',
    mechanics: ['push', 'pickup', 'traffic', 'hazard', 'coordinates'],
  },
};
