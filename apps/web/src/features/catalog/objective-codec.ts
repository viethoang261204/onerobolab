import { entityId, type Objective } from '@robolab/shared';
import type { ApiObjective } from '../account/student-api';

/*
 * Mission objectives ⇄ `level_objectives` rows. The database has a fixed
 * set of objective types; objectives the simulator tracks that have no type
 * of their own (crates pushed into a zone, crates delivered) are stored as
 * CUSTOM with `config.tracked = true` and the objective in `config` — the
 * server then requires them like any other objective. Bonus objectives are
 * rows with `required = false`. One codec for the seed export, the API
 * adapter and the tests.
 */

export interface ObjectiveRow {
  readonly type: ApiObjective['type'];
  readonly config: Record<string, unknown>;
  readonly required: boolean;
  readonly checkpointCode: string | null;
}

/** How an objective is stored. */
export function objectiveToRow(o: Objective): ObjectiveRow {
  const required = !o.optional;
  switch (o.type) {
    case 'reachCheckpoint':
      return { type: 'REACH_CHECKPOINT', config: {}, required, checkpointCode: String(o.checkpointId) };
    case 'reachAllCheckpoints':
      return { type: 'REACH_ALL_CHECKPOINTS', config: o.ordered ? { ordered: true } : {}, required, checkpointCode: null };
    case 'reachFinish':
      return { type: 'REACH_GOAL', config: {}, required, checkpointCode: null };
    case 'avoidCollisions':
      return { type: 'AVOID_COLLISIONS', config: { maxCollisions: o.maxCollisions }, required, checkpointCode: null };
    case 'finishWithin':
      return { type: 'FINISH_WITHIN', config: { seconds: o.seconds }, required, checkpointCode: null };
    case 'pushToZone':
      return { type: 'CUSTOM', config: { tracked: true, kind: 'pushToZone', zoneId: String(o.zoneId), count: o.count }, required, checkpointCode: null };
    case 'deliverCargo':
      return { type: 'CUSTOM', config: { tracked: true, kind: 'deliverCargo', count: o.count, ...(o.zoneId && { zoneId: String(o.zoneId) }) }, required, checkpointCode: null };
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A stored objective as the mission engine's objective, or null when the simulator can't track it. */
export function objectiveFromRow(o: Pick<ApiObjective, 'code' | 'title' | 'type' | 'config' | 'required' | 'checkpointCode'>): Objective | null {
  const base = { id: o.code, label: o.title, ...(!o.required && { optional: true }) };
  const c = o.config;
  switch (o.type) {
    case 'REACH_CHECKPOINT':
      return o.checkpointCode ? { ...base, type: 'reachCheckpoint', checkpointId: entityId(o.checkpointCode) } : null;
    case 'REACH_ALL_CHECKPOINTS':
      return { ...base, type: 'reachAllCheckpoints', ordered: c.ordered === true };
    case 'REACH_GOAL':
      return { ...base, type: 'reachFinish' };
    case 'AVOID_COLLISIONS':
      return { ...base, type: 'avoidCollisions', maxCollisions: isNum(c.maxCollisions) ? c.maxCollisions : 0 };
    case 'FINISH_WITHIN':
      return isNum(c.seconds) ? { ...base, type: 'finishWithin', seconds: c.seconds } : null;
    case 'CUSTOM':
      if (c.tracked !== true || !isNum(c.count)) return null;
      if (c.kind === 'pushToZone' && typeof c.zoneId === 'string') return { ...base, type: 'pushToZone', zoneId: entityId(c.zoneId), count: c.count };
      if (c.kind === 'deliverCargo') return { ...base, type: 'deliverCargo', count: c.count, ...(typeof c.zoneId === 'string' && { zoneId: entityId(c.zoneId) }) };
      return null;
    default:
      // START_PROGRAM, USE_MAX_BLOCKS: judged by the server, shown from `server.objectives`.
      return null;
  }
}
