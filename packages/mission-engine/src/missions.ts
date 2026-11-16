import { entityId, mapId, missionId, robotId, type MissionDefinition } from '@robolab/shared';

/** Mission 1 on the "Rescue the Supplies" map. Ids refer to that map's entities. */
export const RESCUE_MISSION: MissionDefinition = {
  id: missionId('mission-1-rescue'),
  title: 'Rescue the Supplies',
  description: 'Drive along the track through all three checkpoints to the supply area without hitting anything.',
  mapId: mapId('rescue-supplies'),
  robotId: robotId('rover'),
  objectives: [
    { id: 'cp-1', type: 'reachCheckpoint', checkpointId: entityId('cp-1') },
    { id: 'cp-2', type: 'reachCheckpoint', checkpointId: entityId('cp-2') },
    { id: 'cp-3', type: 'reachCheckpoint', checkpointId: entityId('cp-3') },
    { id: 'goal', type: 'reachFinish' },
    { id: 'safe', type: 'avoidCollisions', maxCollisions: 0 },
  ],
  timeLimit: null,
  failOnCollision: true,
  scoring: {
    completionPoints: 500,
    checkpointPoints: 100,
    timeBonus: { parSeconds: 45, maxPoints: 200 },
    efficiencyBonus: { parBlocks: 6, maxPoints: 100 },
    collisionPenalty: 100,
  },
};
