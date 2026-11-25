import {
  angleDelta,
  clamp,
  type Expression,
  type Pose2D,
  type Program,
  type ProgramRunState,
  type ProgramStatus,
  type RuntimeValue,
  type SensorSnapshot,
  type Statement,
  type WheelSpeeds,
} from '@robolab/shared';
import { evaluateBool, evaluateNumber, ProgramProblem, type EvalContext } from './evaluate.ts';

export interface CommandQueueOptions {
  readonly maxWheelSpeed: number;
  /** Track width (m) — converts wheel speed to turn rate. */
  readonly trackWidth: number;
  /** Program speed before any "set speed" (0–1). */
  readonly defaultSpeed?: number;
  /** Max non-blocking statements per tick (loops without waits yield instead of freezing). */
  readonly statementBudget?: number;
  /** Seed for `random` blocks (same seed → same run). */
  readonly seed?: number;
  /** Numbers the mission gives the program (`mission.target`…). */
  readonly data?: Readonly<Record<string, number>>;
  /**
   * Carries out `pick` / `drop` in the world. Returns a student-facing
   * problem ("there is no crate in front of the robot") or null on success.
   */
  readonly interact?: (action: 'pick' | 'drop', pose: Pose2D) => string | null;
}

/** How long the gripper takes to pick up or set down a crate (s). */
export const GRIP_SECONDS = 0.6;

export interface TickInput {
  readonly dt: number;
  /** Robot pose after the previous tick (from kinematics / physics). */
  readonly pose: Pose2D;
  readonly sensors: SensorSnapshot;
}

/** Evaluated arguments of a command, for logs and UI. */
export interface CommandArgs {
  readonly distance?: number;
  readonly angle?: number;
  readonly seconds?: number;
  readonly speed?: number;
  readonly value?: number;
}

export type CommandEvent =
  | { readonly type: 'commandStarted'; readonly statement: Statement; readonly args: CommandArgs }
  | { readonly type: 'commandFinished'; readonly statement: Statement; readonly args: CommandArgs }
  | { readonly type: 'variableChanged'; readonly name: string; readonly value: RuntimeValue }
  | { readonly type: 'finished'; readonly reason: 'end' | 'stopBlock' }
  | { readonly type: 'error'; readonly message: string; readonly blockId: string | null };

export interface TickOutput {
  readonly wheels: WheelSpeeds;
  readonly events: readonly CommandEvent[];
}

type Active =
  | { kind: 'move'; statement: Statement; sign: 1 | -1; speed: number; remaining: number; total: number; last: Pose2D }
  | { kind: 'turn'; statement: Statement; sign: 1 | -1; rate: number; remaining: number; total: number; lastHeading: number }
  | { kind: 'wait'; statement: Statement; remaining: number; total: number };

interface Frame {
  readonly body: readonly Statement[];
  index: number;
  loop: { kind: 'repeat'; remaining: number } | { kind: 'while'; statement: Extract<Statement, { op: 'while' }> } | null;
}

const EPS = 1e-7;
const STOPPED: WheelSpeeds = { left: 0, right: 0 };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tick-driven interpreter for RoboLab IR — the command queue.
 *
 * Blocking commands (move, turn, wait) span many ticks and complete by
 * odometry (pose deltas reported back each tick), so they land exactly on
 * target; everything else runs instantly within a per-tick budget. Control
 * flow (repeat / while / if) is evaluated at runtime with live sensors — loops
 * are frames that rewind, never expanded, so "forever" uses constant memory.
 * Deterministic: same program + same inputs + same seed → same output.
 */
export class CommandQueue {
  private frames: Frame[] = [];
  private active: Active | null = null;
  private variables: Record<string, RuntimeValue> = {};
  private speed: number;
  private state: ProgramRunState = 'idle';
  private executed = 0;
  private error: string | null = null;
  private lastSource: string | null = null;
  private random: () => number;
  private readonly budget: number;
  private readonly program: Program;
  private readonly options: CommandQueueOptions;

  constructor(program: Program, options: CommandQueueOptions) {
    this.program = program;
    this.options = options;
    this.budget = options.statementBudget ?? 500;
    this.speed = options.defaultSpeed ?? 0.5;
    this.random = mulberry32(options.seed ?? 1);
    this.reset();
  }

  /** Back to the first command; variables zeroed; not running. */
  reset(): void {
    this.frames = [{ body: this.program.body, index: 0, loop: null }];
    this.active = null;
    this.variables = Object.fromEntries(this.program.variables.map((v) => [v, 0]));
    this.speed = this.options.defaultSpeed ?? 0.5;
    this.state = 'idle';
    this.executed = 0;
    this.error = null;
    this.lastSource = null;
    this.random = mulberry32(this.options.seed ?? 1);
  }

  start(): void {
    if (this.state === 'idle') this.state = 'running';
  }

  pause(): void {
    if (this.state === 'running') this.state = 'paused';
  }

  resume(): void {
    if (this.state === 'paused') this.state = 'running';
  }

  /** Stop immediately (user pressed Stop, or the robot crashed). */
  halt(error: string | null = null, blockId: string | null = null): void {
    this.active = null;
    this.frames = [];
    if (error) {
      this.state = 'error';
      this.error = error;
      if (blockId) this.lastSource = blockId;
    } else if (this.state !== 'error') this.state = 'finished';
  }

  get status(): ProgramStatus {
    return {
      state: this.state,
      activeBlockId: this.state === 'running' || this.state === 'paused' || this.state === 'error' ? this.lastSource : null,
      variables: { ...this.variables },
      executedStatements: this.executed,
      error: this.error,
    };
  }

  /** Current blocking command and its progress (0–1). */
  current(): { statement: Statement; progress: number } | null {
    const a = this.active;
    if (!a) return null;
    return { statement: a.statement, progress: a.total > 0 ? 1 - a.remaining / a.total : 1 };
  }

  get currentSpeed(): number {
    return this.speed;
  }

  update(input: TickInput): TickOutput {
    const events: CommandEvent[] = [];
    if (this.state !== 'running') return { wheels: STOPPED, events };
    const ctx: EvalContext = { variables: this.variables, sensors: input.sensors, random: this.random, pose: input.pose, data: this.options.data ?? {} };
    try {
      this.progress(input, events);
      let budget = this.budget;
      while (!this.active && this.state === 'running' && budget-- > 0) {
        const stmt = this.next(ctx);
        if (stmt === 'yield') break; // e.g. an empty “forever”: keep running, do nothing this tick
        if (!stmt) {
          this.state = 'finished';
          events.push({ type: 'finished', reason: 'end' });
          break;
        }
        this.execute(stmt, ctx, input, events);
      }
      return { wheels: this.wheels(input.dt), events };
    } catch (e) {
      if (!(e instanceof ProgramProblem)) throw e;
      const blockId = e.blockId ?? this.lastSource;
      this.halt(e.message, blockId);
      events.push({ type: 'error', message: e.message, blockId });
      return { wheels: STOPPED, events };
    }
  }

  /** Advance the blocking command using how far the robot actually moved. */
  private progress(input: TickInput, events: CommandEvent[]): void {
    const a = this.active;
    if (!a) return;
    if (a.kind === 'move') {
      a.remaining -= Math.hypot(input.pose.x - a.last.x, input.pose.z - a.last.z);
      a.last = input.pose;
    } else if (a.kind === 'turn') {
      a.remaining -= Math.abs(angleDelta(a.lastHeading, input.pose.heading));
      a.lastHeading = input.pose.heading;
    } else {
      a.remaining -= input.dt;
    }
    if (a.remaining <= EPS) {
      this.active = null;
      const args: CommandArgs = a.kind === 'move' ? { distance: a.total } : a.kind === 'turn' ? { angle: a.total } : { seconds: a.total };
      events.push({ type: 'commandFinished', statement: a.statement, args });
    }
  }

  /** Wheel speeds for this tick; the final tick is shortened to land exactly on target. */
  private wheels(dt: number): WheelSpeeds {
    const a = this.active;
    if (!a || a.kind === 'wait' || dt <= 0) return STOPPED;
    if (a.kind === 'move') {
      const v = (a.sign * Math.min(a.speed * dt, a.remaining)) / dt;
      return { left: v, right: v };
    }
    const w = Math.min(a.rate * dt, a.remaining) / dt; // rad/s
    const surface = (w * this.options.trackWidth) / 2;
    return { left: -a.sign * surface, right: a.sign * surface };
  }

  /** Next statement to run, 'yield' to wait for the next tick, or null when the program is done. */
  private next(ctx: EvalContext): Statement | 'yield' | null {
    for (let guard = 0; guard < 10_000; guard++) {
      const f = this.frames[this.frames.length - 1];
      if (!f) return null;
      const stmt = f.body[f.index];
      if (stmt) {
        f.index++;
        return stmt;
      }
      if (f.loop?.kind === 'repeat' && --f.loop.remaining > 0) {
        f.index = 0;
        continue;
      }
      if (f.loop?.kind === 'while' && evaluateBool(f.loop.statement.condition, ctx)) {
        f.index = 0;
        // an empty loop must yield, not spin (and not end the program)
        if (f.body.length === 0) return 'yield';
        continue;
      }
      this.frames.pop();
    }
    return null;
  }

  private execute(stmt: Statement, ctx: EvalContext, input: TickInput, events: CommandEvent[]): void {
    this.executed++;
    if (stmt.source) this.lastSource = stmt.source.blockId;
    const withBlock = <T>(fn: () => T): T => {
      try {
        return fn();
      } catch (e) {
        if (e instanceof ProgramProblem && !e.blockId) throw new ProgramProblem(e.message, stmt.source?.blockId ?? null);
        throw e;
      }
    };
    const max = this.options.maxWheelSpeed;
    const speedOf = (e: Expression | undefined) => clamp(e ? withBlock(() => evaluateNumber(e, ctx)) : this.speed, 0, 1);

    switch (stmt.op) {
      case 'move': {
        const d = withBlock(() => evaluateNumber(stmt.distance, ctx));
        const speed = speedOf(stmt.speed) * max;
        const dirSign = (stmt.direction === 'forward' ? 1 : -1) * (d < 0 ? -1 : 1);
        const total = Math.abs(d);
        events.push({ type: 'commandStarted', statement: stmt, args: { distance: total, speed: speed / max } });
        if (total <= EPS) return void events.push({ type: 'commandFinished', statement: stmt, args: { distance: 0 } });
        if (speed <= 0) throw new ProgramProblem('The speed is 0 %, so the robot can’t move. Use “set speed” with a bigger number.', stmt.source?.blockId ?? null);
        this.active = { kind: 'move', statement: stmt, sign: dirSign as 1 | -1, speed, remaining: total, total, last: input.pose };
        return;
      }
      case 'turn': {
        const a = withBlock(() => evaluateNumber(stmt.angle, ctx));
        const speed = speedOf(stmt.speed) * max;
        const sign = ((stmt.direction === 'left' ? 1 : -1) * (a < 0 ? -1 : 1)) as 1 | -1;
        const total = Math.abs(a);
        events.push({ type: 'commandStarted', statement: stmt, args: { angle: total, speed: speed / max } });
        if (total <= EPS) return void events.push({ type: 'commandFinished', statement: stmt, args: { angle: 0 } });
        if (speed <= 0) throw new ProgramProblem('The speed is 0 %, so the robot can’t turn. Use “set speed” with a bigger number.', stmt.source?.blockId ?? null);
        this.active = { kind: 'turn', statement: stmt, sign, rate: speed / (this.options.trackWidth / 2), remaining: total, total, lastHeading: input.pose.heading };
        return;
      }
      case 'wait': {
        const s = Math.max(0, withBlock(() => evaluateNumber(stmt.seconds, ctx)));
        events.push({ type: 'commandStarted', statement: stmt, args: { seconds: s } });
        if (s <= EPS) return void events.push({ type: 'commandFinished', statement: stmt, args: { seconds: 0 } });
        this.active = { kind: 'wait', statement: stmt, remaining: s, total: s };
        return;
      }
      case 'stop':
        events.push({ type: 'commandStarted', statement: stmt, args: {} });
        this.active = null;
        this.frames = [];
        this.state = 'finished';
        events.push({ type: 'finished', reason: 'stopBlock' });
        return;
      case 'setSpeed': {
        this.speed = clamp(withBlock(() => evaluateNumber(stmt.speed, ctx)), 0, 1);
        events.push({ type: 'commandStarted', statement: stmt, args: { speed: this.speed } });
        return;
      }
      case 'drive':
        // Continuous driving isn't produced by blocks yet; treated as a short move.
        this.active = { kind: 'move', statement: stmt, sign: stmt.direction === 'forward' ? 1 : -1, speed: speedOf(stmt.speed) * max, remaining: 0.05, total: 0.05, last: input.pose };
        return;
      case 'setVar':
      case 'changeVar': {
        const value = withBlock(() => evaluateNumber(stmt.op === 'setVar' ? stmt.value : stmt.delta, ctx));
        const prev = this.variables[stmt.name];
        const next = stmt.op === 'setVar' ? value : (typeof prev === 'number' ? prev : 0) + value;
        this.variables[stmt.name] = next;
        events.push({ type: 'commandStarted', statement: stmt, args: { value: next } });
        events.push({ type: 'variableChanged', name: stmt.name, value: next });
        return;
      }
      case 'repeat': {
        const times = Math.floor(withBlock(() => evaluateNumber(stmt.times, ctx)));
        if (times > 0 && stmt.body.length > 0) this.frames.push({ body: stmt.body, index: 0, loop: { kind: 'repeat', remaining: times } });
        return;
      }
      case 'while':
        if (withBlock(() => evaluateBool(stmt.condition, ctx))) this.frames.push({ body: stmt.body, index: 0, loop: { kind: 'while', statement: stmt } });
        return;
      case 'if': {
        const branch = withBlock(() => evaluateBool(stmt.condition, ctx)) ? stmt.then : (stmt.else ?? []);
        if (branch.length > 0) this.frames.push({ body: branch, index: 0, loop: null });
        return;
      }
      case 'break': {
        events.push({ type: 'commandStarted', statement: stmt, args: {} });
        if (!this.frames.some((f) => f.loop)) return;
        for (let f = this.frames.pop(); f; f = this.frames.pop()) if (f.loop) return;
        return;
      }
      case 'pick':
      case 'drop': {
        events.push({ type: 'commandStarted', statement: stmt, args: {} });
        const problem = this.options.interact ? this.options.interact(stmt.op, input.pose) : 'This robot has no gripper.';
        if (problem) throw new ProgramProblem(problem, stmt.source?.blockId ?? null);
        this.active = { kind: 'wait', statement: stmt, remaining: GRIP_SECONDS, total: GRIP_SECONDS };
        return;
      }
      case 'goTo': {
        const x = withBlock(() => evaluateNumber(stmt.x, ctx));
        const y = withBlock(() => evaluateNumber(stmt.y, ctx));
        const dx = x - input.pose.x;
        const dz = -y - input.pose.z;
        const dist = Math.hypot(dx, dz);
        events.push({ type: 'commandStarted', statement: stmt, args: { distance: dist } });
        if (dist < 1e-3) return;
        const turn = angleDelta(input.pose.heading, Math.atan2(-dz, dx));
        const source = stmt.source ? { source: stmt.source } : {};
        const body: Statement[] = [
          { op: 'turn', direction: turn >= 0 ? 'left' : 'right', angle: { kind: 'number', value: Math.abs(turn) }, ...source },
          { op: 'move', direction: 'forward', distance: { kind: 'number', value: dist }, ...source },
        ];
        this.frames.push({ body, index: 0, loop: null });
        return;
      }
    }
  }
}
