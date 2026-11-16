import {
  signalPhase,
  Vec2Math,
  type EntityId,
  type MapQuery,
  type MissionDefinition,
  type MissionEngine,
  type MissionFailureReason,
  type MissionState,
  type MissionStatus,
  type Objective,
  type ObjectiveProgress,
  type SimulationSnapshot,
} from '@robolab/shared';

/**
 * Mission Engine: derives mission state from simulation snapshots. It never
 * changes the simulation — the runtime reacts to the returned status.
 *
 * Objectives:
 *   reachCheckpoint, reachAllCheckpoints (optionally in order), reachFinish
 *   (optionally: stopped inside the finish), pushToZone (crates in a
 *   construction zone), deliverCargo (crates dropped in delivery zones) —
 *   the "task" objectives — plus avoidCollisions and finishWithin, judged
 *   when every required task is done. Optional (bonus) objectives never
 *   block success.
 *
 * Failure: collision (if configured), timeout, leaving the course, driving
 * into a hazard zone, entering a crossing on red, dropping a crate in the
 * wrong place, or reaching checkpoints out of order (ordered missions).
 */
/** Below these speeds the robot counts as stopped (m/s, rad/s). */
const STOP_LINEAR = 0.01;
const STOP_ANGULAR = 0.05;

const TASKS = new Set<Objective['type']>(['reachCheckpoint', 'reachAllCheckpoints', 'reachFinish', 'pushToZone', 'deliverCargo']);
const isTask = (o: Objective) => TASKS.has(o.type);

export class MissionTracker implements MissionEngine {
  private mission: MissionDefinition | null = null;
  private map: MapQuery | null = null;
  private state: MissionState | null = null;
  private visited: EntityId[] = [];
  private collisions = 0;
  private inCrossing = new Set<EntityId>();

  load(mission: MissionDefinition, map: MapQuery): void {
    this.mission = mission;
    this.map = map;
    this.reset();
  }

  reset(): void {
    const m = this.mission;
    this.visited = [];
    this.collisions = 0;
    this.inCrossing = new Set();
    this.state = m
      ? {
          missionId: m.id,
          status: 'notStarted',
          elapsed: 0,
          objectives: m.objectives.map((o) => ({ objectiveId: o.id, completed: false, completedAt: null, ...this.counter(o, 0), ...(o.optional && { optional: true }) })),
          visitedCheckpoints: [],
          collisionCount: 0,
          failureReason: null,
        }
      : null;
  }

  getState(): MissionState {
    if (!this.state) throw new Error('No mission loaded.');
    return this.state;
  }

  /** `progress` for counting objectives. */
  private counter(o: Objective, done: number): Pick<ObjectiveProgress, 'progress'> {
    if (o.type !== 'pushToZone' && o.type !== 'deliverCargo') return {};
    const total = this.target(o);
    return { progress: { done: Math.min(done, total), total } };
  }

  /** How many an objective needs: `deliverCargo` with count 0 means every crate on the map. */
  private target(o: Extract<Objective, { type: 'pushToZone' | 'deliverCargo' }>): number {
    if (o.count > 0 || o.type === 'pushToZone') return o.count;
    return (this.map?.entitiesOfType('cargo') ?? []).reduce((n, c) => n + c.items.length, 0);
  }

  observe(snapshot: SimulationSnapshot): MissionState {
    const m = this.mission;
    const map = this.map;
    const prev = this.getState();
    if (!m || !map || prev.status === 'success' || prev.status === 'failure') return prev;
    if (snapshot.phase !== 'running' && prev.status === 'notStarted') return prev;

    const t = snapshot.time;
    const pos = { x: snapshot.robot.pose.x, z: snapshot.robot.pose.z };
    let failure: MissionFailureReason | null = null;

    // Checkpoints (ordered missions only accept the next expected one; strict ones fail on a skip).
    const ordered = m.orderedCheckpoints === true || m.objectives.some((o) => o.type === 'reachAllCheckpoints' && o.ordered);
    const all = [...map.entitiesOfType('checkpoint')].sort((a, b) => a.order - b.order);
    for (const cp of map.checkpointsAt(pos)) {
      if (this.visited.includes(cp.id)) continue;
      const expected = all.find((c) => !this.visited.includes(c.id));
      if (!ordered || expected?.id === cp.id) this.visited.push(cp.id);
      else if (m.orderedCheckpoints) failure = 'wrongOrder';
    }
    this.collisions += snapshot.contacts.filter((c) => c.started).length;
    const v = snapshot.robot.velocity;
    const resting = Math.abs(v.linear) < STOP_LINEAR && Math.abs(v.angular) < STOP_ANGULAR;
    const inFinish = map.isInFinish(pos) && (!m.stopInFinish || resting);

    // Mission objects.
    for (const z of map.entitiesOfType('zone')) if (z.kind === 'hazard' && Vec2Math.isPointInArea(z.area, pos)) failure = 'hazard';
    for (const l of map.entitiesOfType('trafficLight')) {
      const inside = Vec2Math.isPointInArea(l.crossing, pos);
      if (inside && !this.inCrossing.has(l.id) && signalPhase(l, t) === 'red') failure = 'redLight';
      if (inside) this.inCrossing.add(l.id);
      else this.inCrossing.delete(l.id);
    }
    const drops = snapshot.world?.drops ?? [];
    if (drops.some((d) => !d.correct)) failure = 'wrongDelivery';

    const crates = snapshot.dynamicEntities;
    const count = (o: Objective): number => {
      if (o.type === 'pushToZone') {
        const zone = map.entitiesOfType('zone').find((z) => z.id === o.zoneId);
        return zone ? crates.filter((c) => Vec2Math.isPointInArea(zone.area, c.pose)).length : 0;
      }
      if (o.type === 'deliverCargo') return drops.filter((d) => d.correct && (!o.zoneId || d.zoneId === o.zoneId)).length;
      return 0;
    };

    const done = (id: string) => prev.objectives.find((o) => o.objectiveId === id)?.completedAt ?? null;
    const task = (o: Objective): boolean => {
      switch (o.type) {
        case 'reachCheckpoint':
          return this.visited.includes(o.checkpointId);
        case 'reachAllCheckpoints':
          return all.every((c) => this.visited.includes(c.id));
        case 'reachFinish':
          return inFinish;
        case 'pushToZone':
        case 'deliverCargo':
          return count(o) >= this.target(o);
        default:
          return false;
      }
    };

    const tasksDone = m.objectives.filter((o) => isTask(o) && !o.optional).every((o) => done(o.id) !== null || task(o));
    const objectives: ObjectiveProgress[] = m.objectives.map((o) => {
      const extra = { ...this.counter(o, count(o)), ...(o.optional && { optional: true }) };
      const at = done(o.id);
      if (at !== null) return { objectiveId: o.id, completed: true, completedAt: at, ...extra, ...(extra.progress && { progress: { done: extra.progress.total, total: extra.progress.total } }) };
      let completed = false;
      if (isTask(o)) completed = task(o);
      else if (o.type === 'avoidCollisions') completed = tasksDone && this.collisions <= o.maxCollisions;
      else if (o.type === 'finishWithin') completed = tasksDone && t <= o.seconds;
      return { objectiveId: o.id, completed, completedAt: completed ? t : null, ...extra };
    });

    let status: MissionStatus = 'running';
    let failureReason: MissionFailureReason | null = null;
    const limit = m.objectives.find((o) => o.type === 'avoidCollisions');
    if ((m.failOnCollision && this.collisions > 0) || (limit?.type === 'avoidCollisions' && this.collisions > limit.maxCollisions)) {
      status = 'failure';
      failureReason = snapshot.contacts.some((c) => c.target === 'boundary') ? 'outOfBounds' : 'collision';
    } else if (failure) {
      status = 'failure';
      failureReason = failure;
    } else if (m.timeLimit !== null && t > m.timeLimit) {
      status = 'failure';
      failureReason = 'timeout';
    } else if (objectives.every((o) => o.completed || o.optional)) {
      status = 'success';
    }

    this.state = { missionId: m.id, status, elapsed: t, objectives, visitedCheckpoints: [...this.visited], collisionCount: this.collisions, failureReason };
    return this.state;
  }

  /** Program ended without success: fail the mission if it was running. */
  endRun(reason: MissionFailureReason = 'programEnded'): MissionState {
    const s = this.getState();
    if (s.status === 'running') this.state = { ...s, status: 'failure', failureReason: reason };
    return this.getState();
  }
}
