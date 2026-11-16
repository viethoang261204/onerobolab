import type { MapDefinition, MissionDefinition, MissionState, Objective } from '@robolab/shared';
import type { MissionObjectiveView, MissionView } from '../types/ui';

/** Student-facing text for an objective. */
function objectiveLabel(o: Objective, map: MapDefinition): string {
  if (o.label) return o.label;
  switch (o.type) {
    case 'reachCheckpoint': {
      const cp = map.entities.find((e) => e.id === o.checkpointId);
      return `Reach checkpoint ${cp?.type === 'checkpoint' ? cp.order : ''}`.trim();
    }
    case 'reachAllCheckpoints':
      return o.ordered ? 'Pass every checkpoint in order' : 'Pass every checkpoint';
    case 'reachFinish':
      return 'Reach the goal';
    case 'avoidCollisions':
      return o.maxCollisions === 0 ? 'Don’t hit any obstacles' : `Hit at most ${o.maxCollisions} obstacles`;
    case 'finishWithin':
      return `Finish within ${o.seconds} s`;
    case 'pushToZone':
      return `Push ${o.count} crate${o.count === 1 ? '' : 's'} into the construction zone`;
    case 'deliverCargo':
      return o.count === 0 ? 'Deliver every crate' : `Deliver ${o.count} crate${o.count === 1 ? '' : 's'}`;
  }
}

/**
 * Mission definition + live state → what the mission card shows. The first
 * unfinished route objective is "active"; a broken no-collision rule is "failed".
 */
export function buildMissionView(mission: MissionDefinition, map: MapDefinition, state: MissionState | null): MissionView {
  let activeAssigned = false;
  const objectives: MissionObjectiveView[] = mission.objectives.map((o) => {
    const progress = state?.objectives.find((p) => p.objectiveId === o.id);
    let s: MissionObjectiveView['state'] = 'pending';
    if (progress?.completed) s = 'done';
    else if (o.type === 'avoidCollisions' && (state?.collisionCount ?? 0) > o.maxCollisions) s = 'failed';
    else if (state?.status === 'running' && !activeAssigned && !o.optional && o.type !== 'avoidCollisions' && o.type !== 'finishWithin') {
      s = 'active';
      activeAssigned = true;
    }
    const allCrates = map.entities.reduce((n, e) => n + (e.type === 'cargo' ? e.items.length : 0), 0);
    const count = progress?.progress ?? ((o.type === 'pushToZone' || o.type === 'deliverCargo') && { done: 0, total: o.count || allCrates });
    return { id: o.id, label: objectiveLabel(o, map), state: s, ...(count && { progress: `${count.done}/${count.total}` }), ...(o.optional && { bonus: true }) };
  });
  const outcome = state?.status === 'success' ? 'success' : state?.status === 'failure' && state.failureReason !== 'programEnded' ? 'failure' : null;
  return { title: mission.title, objectives, outcome };
}
