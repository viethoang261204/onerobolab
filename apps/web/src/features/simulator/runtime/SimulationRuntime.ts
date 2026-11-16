import { MissionTracker } from '@robolab/mission-engine';
import { CollisionWorld, type Contact } from '@robolab/physics-engine';
import { CommandQueue, PathFollower, type CommandEvent } from '@robolab/robot-engine';
import { SensorSuite } from '@robolab/sensor-engine';
import { WorldObjects } from '@robolab/world-engine';
import {
  DEFAULT_SIMULATION_CONFIG,
  Vec2Math,
  type MapQuery,
  type Pose2D,
  type SensorColor,
  type MissionDefinition,
  type MissionState,
  type Program,
  type SimulationConfig,
  type SimulationSnapshot,
  type Vec2,
} from '@robolab/shared';
import type { RobotRuntime } from '../robot/RobotMovement';
import { RuntimeEvents, type ExecutionMode } from './RuntimeEvents';
import { EMPTY_SENSORS, type RunState, type RuntimeSnapshot, type SensorSummary } from './RuntimeState';

export interface SimulationRuntimeOptions {
  readonly map: MapQuery;
  /** The robot's live state (kinematics from UI 3; read by the renderer). */
  readonly robot: RobotRuntime;
  readonly mission: MissionDefinition | null;
  readonly config?: Partial<SimulationConfig>;
  /** Seed for random blocks (determinism / grading). */
  readonly seed?: number;
  /** Numbers the mission gives the program for this run (`mission.target`). */
  readonly data?: Readonly<Record<string, number>>;
}

/** Below these speeds the robot counts as resting (gate scanners), m/s and rad/s. */
const REST_LINEAR = 0.01;
const REST_ANGULAR = 0.05;

/** Demo autopilot path: the line nearest the spawn, oriented away from it, into the goal. */
export function demoPath(map: MapQuery): Vec2[] {
  const { start, finish } = map.definition;
  let best: Vec2[] = [];
  let bestDist = Infinity;
  for (const line of map.entitiesOfType('line')) {
    const first = line.points[0];
    const last = line.points[line.points.length - 1];
    if (!first || !last) continue;
    const dFirst = Vec2Math.distance(first, start);
    const dLast = Vec2Math.distance(last, start);
    if (Math.min(dFirst, dLast) < bestDist) {
      bestDist = Math.min(dFirst, dLast);
      best = dFirst <= dLast ? [...line.points] : [...line.points].reverse();
    }
  }
  if (best.length < 2) best = [{ x: start.x, z: start.z }];
  return [...best, finish.center];
}

const sameSensors = (a: SensorSummary, b: SensorSummary) => a.obstacle === b.obstacle && a.line === b.line && a.color === b.color && a.touch === b.touch;

/**
 * The simulation runtime (framework-free). One fixed tick:
 *
 *   world clock (movers) → sensors.sample (live floor signals)
 *   → command queue (or demo autopilot; pick / drop act on the world)
 *   → wheel speeds → kinematics step (RobotRuntime) → push crates
 *   → collisions (revert + stop) → gate scanners → mission tracker → events
 *
 * Driven by `advance(realDelta)` from the render loop, or `step()` in tests.
 * Same map + program + spawn + seed ⇒ same run.
 */
export class SimulationRuntime {
  readonly events = new RuntimeEvents();
  readonly config: SimulationConfig;
  private readonly world: CollisionWorld;
  private readonly objects: WorldObjects;
  /** The map as sensors see it: the painted floor plus live signals (lights, crate tiles). */
  private readonly liveMap: MapQuery;
  private readonly sensors = new SensorSuite();
  private readonly tracker = new MissionTracker();
  private queue: CommandQueue | null = null;
  private follower: PathFollower | null = null;
  private runState: RunState = 'idle';
  private mode: ExecutionMode = 'userProgram';
  private time = 0;
  private tick = 0;
  private acc = 0;
  private contacts = new Set<string>();
  private summary: SensorSummary = EMPTY_SENSORS;
  private errorBlockId: string | null = null;
  private mission: MissionState | null = null;
  private readonly half: Vec2;

  constructor(private readonly opts: SimulationRuntimeOptions) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...opts.config };
    this.world = new CollisionWorld(opts.map);
    this.objects = new WorldObjects(opts.map);
    this.liveMap = liveMap(opts.map, (p) => this.objects.surfaceColor(p, this.time));
    this.sensors.configure(opts.robot.definition.sensors);
    if (opts.mission) this.tracker.load(opts.mission, opts.map);
    const d = opts.robot.definition;
    // slightly forgiving footprint: body length × width across the wheels
    this.half = { x: (d.bodySize.x / 2) * 0.95, z: ((d.wheelBase + d.wheelWidth) / 2) * 0.95 };
    this.reset();
  }

  get state(): RunState {
    return this.runState;
  }

  get collisionWorld(): CollisionWorld {
    return this.world;
  }

  /** Gates, cargo and signals (read by the renderer every frame). */
  get worldObjects(): WorldObjects {
    return this.objects;
  }

  /** Simulation time of the current run (s). */
  get clock(): number {
    return this.time;
  }

  /** Execute a compiled user program from the spawn point. */
  runProgram(program: Program): void {
    this.begin('userProgram');
    const d = this.opts.robot.definition;
    this.queue = new CommandQueue(program, {
      maxWheelSpeed: d.maxWheelSpeed,
      trackWidth: d.wheelBase,
      defaultSpeed: 0.5,
      seed: this.opts.seed ?? 1,
      data: this.opts.data ?? {},
      interact: (action, pose) => this.interact(action, pose),
    });
    this.queue.start();
  }

  /** Run the demo autopilot (line follower) from the spawn point. */
  runDemo(): void {
    this.begin('demo');
    const d = this.opts.robot.definition;
    this.follower = new PathFollower(demoPath(this.opts.map), { lookahead: 0.28, cruiseSpeed: 0.34, maxWheelSpeed: d.maxWheelSpeed, trackWidth: d.wheelBase, arriveTolerance: 0.06 });
  }

  private begin(mode: ExecutionMode): void {
    this.reset(false);
    this.mode = mode;
    this.runState = 'running';
    this.opts.robot.setRobotStatus('running');
    this.tracker.reset();
    this.events.emit({ type: 'programStarted', mode });
  }

  /** Stop immediately (user Stop). The program is kept; Run restarts from the beginning. */
  stop(): void {
    if (this.runState !== 'running' && this.runState !== 'paused') return;
    this.queue?.halt();
    this.runState = 'stopped';
    this.opts.robot.setRobotStatus('stopped');
    this.events.emit({ type: 'programStopped' });
  }

  pause(): void {
    if (this.runState !== 'running') return;
    this.runState = 'paused';
    this.queue?.pause();
    this.opts.robot.setMotorSpeed(0, 0);
  }

  resume(): void {
    if (this.runState !== 'paused') return;
    this.runState = 'running';
    this.queue?.resume();
  }

  /** Everything back to the start: robot, sensors, variables, mission, errors. */
  reset(emit = true): void {
    this.queue = null;
    this.follower = null;
    this.runState = 'idle';
    this.time = 0;
    this.tick = 0;
    this.acc = 0;
    this.contacts.clear();
    this.errorBlockId = null;
    this.world.reset();
    this.objects.reset();
    this.opts.robot.resetRobot(this.opts.map.definition.start);
    this.tracker.reset();
    this.mission = this.opts.mission ? this.tracker.getState() : null;
    this.opts.robot.setSensorState(this.sensors.sample(this.opts.robot.state.pose, { physics: this.world, map: this.liveMap }));
    this.summary = this.readSummary();
    if (emit) this.events.emit({ type: 'reset' });
  }

  /** Run as many fixed ticks as fit in the elapsed real time (capped per frame). */
  advance(realDelta: number): number {
    if (this.runState !== 'running') return 0;
    this.acc += Math.min(realDelta, 0.25) * this.config.timeScale;
    let n = 0;
    while (this.acc >= this.config.fixedDt && n < this.config.maxTicksPerFrame && this.runState === 'running') {
      this.step();
      this.acc -= this.config.fixedDt;
      n++;
    }
    return n;
  }

  /** One fixed simulation tick. */
  step(): void {
    if (this.runState !== 'running') return;
    const dt = this.config.fixedDt;
    const robot = this.opts.robot;
    this.tick++;
    this.time += dt;
    this.world.setTime(this.time);
    const before = robot.state.pose;

    // 1. sense
    const sensors = this.sensors.sample(before, { physics: this.world, map: this.liveMap });
    robot.setSensorState(sensors);
    const summary = this.readSummary();
    if (!sameSensors(summary, this.summary)) this.events.emit({ type: 'sensorChanged', sensors: summary });
    this.summary = summary;

    // 2. decide
    if (this.mode === 'demo' && this.follower) {
      const cmd = this.follower.update(before);
      if (cmd.done) return this.finishProgram('end');
      robot.setMotorSpeed(cmd.wheels.left, cmd.wheels.right);
    } else if (this.queue) {
      const out = this.queue.update({ dt, pose: before, sensors });
      robot.setMotorSpeed(out.wheels.left, out.wheels.right);
      for (const e of out.events) this.forward(e);
      if (this.runState !== 'running') return;
      const qs = this.queue.status.state;
      if (qs === 'finished') return this.finishProgram(out.events.some((e) => e.type === 'finished' && e.reason === 'stopBlock') ? 'stopBlock' : 'end');
      if (qs === 'error') return;
    }

    // 3. move (existing kinematics), pushing crates out of the way
    robot.step(dt);
    this.world.resolvePushes(robot.state.pose, this.half);

    // 4. collide
    const hits = this.world.contacts(robot.state.pose, this.half);
    const started: Contact[] = hits.filter((h) => !this.contacts.has(String(h.id)));
    this.contacts = new Set(hits.map((h) => String(h.id)));
    if (hits.length > 0) {
      this.world.revertPushes();
      robot.setRobotPosition(before); // stop at the contact instead of passing through
      robot.setMotorSpeed(0, 0);
    }

    // Gate scanners: a gate opens once the robot has waited in front of it.
    const resting = Math.abs(robot.state.linear) < REST_LINEAR && Math.abs(robot.state.angular) < REST_ANGULAR;
    for (const id of this.objects.update(dt, robot.state.pose, resting)) {
      this.world.openGate(id);
      this.events.emit({ type: 'gateOpened', entityId: id });
    }

    const first = started[0];
    if (first) {
      const blockId = this.queue?.status.activeBlockId ?? null;
      this.queue?.halt('The robot hit an obstacle.', blockId);
      this.errorBlockId = blockId;
      this.runState = 'error';
      robot.setRobotStatus('error');
      this.events.emit({ type: 'collision', kind: first.kind, entityId: first.id, blockId });
    }

    // 5. mission (also records a collision failure)
    this.observeMission(hits, started);
  }

  private forward(e: CommandEvent): void {
    switch (e.type) {
      case 'commandStarted':
      case 'commandFinished':
        this.events.emit({ type: e.type, statement: e.statement, args: e.args });
        break;
      case 'variableChanged':
        this.events.emit(e);
        break;
      case 'error':
        this.errorBlockId = e.blockId;
        this.runState = 'error';
        this.opts.robot.setRobotStatus('error');
        this.events.emit({ type: 'runtimeError', message: e.message, blockId: e.blockId });
        break;
      case 'finished':
        break; // handled after the update
    }
  }

  /** `pick` / `drop` from the program: act on the world, or explain why not. */
  private interact(action: 'pick' | 'drop', pose: Pose2D): string | null {
    if (action === 'pick') {
      const r = this.objects.pick(pose);
      if (!r.ok) return r.message;
      this.events.emit({ type: 'cargoPicked', itemId: r.item.id, color: r.item.color ?? null });
      return null;
    }
    const r = this.objects.drop(pose);
    if (!r.ok) return r.message;
    this.events.emit({ type: 'cargoDropped', itemId: r.drop.itemId, zoneId: r.drop.zoneId, correct: r.drop.correct, x: r.at.x, z: r.at.z });
    return null;
  }

  private finishProgram(reason: 'end' | 'stopBlock'): void {
    this.opts.robot.setMotorSpeed(0, 0);
    // The robot is at rest now: let the mission see it ("stopped in the delivery zone").
    this.observeMission([], [], true);
    if (this.runState !== 'running') return;
    this.runState = 'finished';
    this.opts.robot.setRobotStatus('idle');
    this.events.emit({ type: 'programFinished', reason });
  }

  private observeMission(hits: readonly Contact[], started: readonly Contact[], atRest = false): void {
    const robot = this.opts.robot;
    const pose = robot.state.pose;
    if (!this.opts.mission) {
      if (this.runState === 'running' && this.opts.map.isInFinish(pose)) this.succeed(true);
      return;
    }
    const prev = this.mission;
    const snapshot: SimulationSnapshot = {
      tick: this.tick,
      time: this.time,
      phase: 'running',
      robot: {
        id: robot.definition.id,
        pose,
        velocity: atRest ? { linear: 0, angular: 0 } : { linear: robot.state.linear, angular: robot.state.angular },
        wheelTargets: robot.state.motors,
        status: 'running',
        odometer: 0,
      },
      sensors: robot.state.sensors,
      program: this.queue?.status ?? { state: 'running', activeBlockId: null, variables: {}, executedStatements: 0, error: null },
      contacts: hits.map((h) => ({ target: h.id, impactSpeed: Math.abs(robot.state.linear), started: started.some((s) => s.id === h.id) })),
      dynamicEntities: this.world.cratePoses(),
      ...(this.objects.active && { world: this.objects.snapshot() }),
    };
    const next = this.tracker.observe(snapshot);
    this.mission = next;
    if (next === prev) return;

    const checkpoints = this.opts.map.entitiesOfType('checkpoint');
    for (const id of next.visitedCheckpoints) {
      if (!prev?.visitedCheckpoints.includes(id)) this.events.emit({ type: 'checkpointReached', order: checkpoints.find((c) => c.id === id)?.order ?? 0 });
    }
    const goalObjective = this.opts.mission.objectives.find((o) => o.type === 'reachFinish');
    const goalDone = (s: MissionState | null) => !!goalObjective && !!s?.objectives.find((o) => o.objectiveId === goalObjective.id)?.completed;
    if (goalDone(next) && !goalDone(prev)) this.events.emit({ type: 'goalReached' });
    this.events.emit({ type: 'missionChanged', mission: next });

    if (next.status === 'success' && this.runState === 'running') this.succeed(false);
    else if (next.status === 'failure' && prev?.status !== 'failure') {
      const reason = next.failureReason ?? 'collision';
      // Rule breaks (hazard, red light, wrong delivery, wrong order, timeout) stop the robot;
      // a crash has already stopped it.
      if (reason !== 'collision' && reason !== 'outOfBounds' && (this.runState === 'running' || this.runState === 'finished')) {
        const blockId = this.queue?.status.activeBlockId ?? null;
        this.queue?.halt();
        this.opts.robot.setMotorSpeed(0, 0);
        this.errorBlockId = blockId;
        this.runState = 'error';
        this.opts.robot.setRobotStatus('error');
      }
      this.events.emit({ type: 'missionFailed', reason });
    }
  }

  private succeed(emitGoal: boolean): void {
    if (emitGoal) this.events.emit({ type: 'goalReached' });
    this.queue?.halt();
    this.opts.robot.setMotorSpeed(0, 0);
    this.runState = 'success';
    this.opts.robot.setRobotStatus('success');
    this.events.emit({ type: 'missionComplete' });
  }

  private readSummary(): SensorSummary {
    const s = this.sensors;
    return { distance: s.getDistance(), line: s.detectLine(), lineOffset: s.getLineOffset(), obstacle: s.detectObstacle(), color: s.getColor(), touch: s.isTouching() };
  }

  snapshot(): RuntimeSnapshot {
    const status = this.queue?.status;
    return {
      runState: this.runState,
      mode: this.mode,
      time: this.time,
      activeBlockId: this.runState === 'running' || this.runState === 'paused' ? (status?.activeBlockId ?? null) : null,
      errorBlockId: this.errorBlockId,
      variables: status?.variables ?? {},
      sensors: this.summary,
      mission: this.mission,
      pose: this.opts.robot.state.pose,
      speed: this.queue?.currentSpeed ?? 0.5,
    };
  }
}

/** A map whose floor colours include live signals (traffic lights, crate tiles). */
function liveMap(map: MapQuery, overlay: (p: Vec2) => SensorColor | null): MapQuery {
  return {
    definition: map.definition,
    bounds: map.bounds,
    entitiesOfType: (type) => map.entitiesOfType(type),
    surfaceAt: (p) => {
      const s = map.surfaceAt(p);
      const color = overlay(p);
      return color ? { ...s, color } : s;
    },
    checkpointsAt: (p) => map.checkpointsAt(p),
    isInFinish: (p) => map.isInFinish(p),
    isInBounds: (p) => map.isInBounds(p),
    isInArea: (a, p) => map.isInArea(a, p),
  };
}
