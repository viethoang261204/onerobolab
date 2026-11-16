import { checkpoint, corridorWalls, levelMap, wall } from '../../environments/level-map';
import { standardMission } from '../../missions/mission-builder';
import type { LevelDefinition } from '../types';

/** The loading-dock wall the distance sensor has to notice. */
const DOCK_X = 2.0;

const map = levelMap({
  id: 'canyon-02',
  name: 'Canyon Warehouse',
  size: { x: 5, z: 3.6 },
  start: { x: -1.1, z: 0, heading: 0 },
  // Goal strip right in front of the dock wall.
  finish: { shape: 'rect', center: { x: DOCK_X - 0.38, z: 0 }, size: { x: 0.3, z: 0.7 }, rotation: 0 },
  entities: [
    checkpoint(1, 0.2, 0, 0.24),
    ...corridorWalls('shelf', [{ x: -2.3, z: 0 }, { x: DOCK_X, z: 0 }], 0.5, { height: 0.5, thickness: 0.3 }),
    wall('dock-door', { x: DOCK_X, z: -0.55 }, { x: DOCK_X, z: 0.55 }, 0.5, 0.12),
  ],
});

export const CANYON_02: LevelDefinition = {
  id: 'canyon-02',
  world: 'canyon-circuit',
  number: 2,
  title: 'Sensor Stop',
  description: 'Drive down the warehouse aisle and let the distance sensor stop you at the dock door.',
  difficulty: 3,
  map,
  environmentId: 'canyon-warehouse',
  scene: { path: [{ x: -2.3, z: 0 }, { x: DOCK_X, z: 0 }], pathWidth: 0.9 },
  mission: standardMission('canyon-02', map, { title: 'Sensor Stop', description: 'Reach the loading strip by the dock door without touching it.', checkpointLabels: ['Pass the scanner gate'], goalLabel: 'Stop on the loading strip' }),
  allowedBlocks: ['event.start', 'motion.forward', 'motion.stop', 'control.forever', 'control.if', 'control.repeat', 'sensor.distance', 'sensor.obstacle', 'logic.compare'],
  intro: ['Drive toward the dock door in small steps', 'Check the distance sensor each step', 'Stop on the loading strip'],
  hints: ['Turn on Sensors in the simulator to see what the distance sensor sees.', 'Inside “repeat forever”: if obstacle ahead? → stop, then move forward 5 cm.', 'The loading strip is right in front of the dock door.'],
  stars: { parBlocks: 4, parSeconds: 20 },
  rewards: { xp: 150 },
};
