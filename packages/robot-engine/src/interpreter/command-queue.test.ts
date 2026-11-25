import { normalizeAngle, sensorId, type Expression, type Pose2D, type Program, type SensorSnapshot, type Statement } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { ROVER } from '../catalog.ts';
import { stepDifferentialDrive } from '../kinematics.ts';
import { CommandQueue, type CommandEvent } from './command-queue.ts';

const DT = 1 / 60;
const num = (value: number): Expression => ({ kind: 'number', value });
const src = (blockId: string) => ({ source: { blockId } });
const move = (m: number, id = 'mv'): Statement => ({ op: 'move', direction: 'forward', distance: num(m), ...src(id) });
const turn = (dir: 'left' | 'right', deg: number, id = 'tn'): Statement => ({ op: 'turn', direction: dir, angle: num((deg * Math.PI) / 180), ...src(id) });
const program = (body: Statement[], variables: string[] = []): Program => ({ irVersion: 1, variables, body });

/** Drive the queue with exact kinematics until it stops (or maxSeconds). */
function run(p: Program, opts: { sensors?: (pose: Pose2D, t: number) => SensorSnapshot; maxSeconds?: number; seed?: number } = {}) {
  const q = new CommandQueue(p, { maxWheelSpeed: ROVER.maxWheelSpeed, trackWidth: ROVER.wheelBase, seed: opts.seed ?? 1 });
  q.start();
  let pose: Pose2D = { x: 0, z: 0, heading: 0 };
  const events: CommandEvent[] = [];
  const active: (string | null)[] = [];
  let t = 0;
  for (; t < (opts.maxSeconds ?? 60) && (q.status.state === 'running' || q.status.state === 'idle'); t += DT) {
    const out = q.update({ dt: DT, pose, sensors: opts.sensors?.(pose, t) ?? {} });
    events.push(...out.events);
    active.push(q.status.activeBlockId);
    pose = stepDifferentialDrive(pose, out.wheels, ROVER.wheelBase, DT).pose;
  }
  return { q, pose, events, active, t };
}

describe('CommandQueue', () => {
  it('10. moves exactly the requested distance', () => {
    const r = run(program([move(0.3)]));
    expect(r.pose.x).toBeCloseTo(0.3, 6);
    expect(r.pose.z).toBeCloseTo(0, 9);
    expect(r.q.status.state).toBe('finished');
  });

  it('11. turns exactly the requested angle (in place, with the wheels)', () => {
    const r = run(program([turn('right', 90)]));
    expect(r.pose.heading).toBeCloseTo(-Math.PI / 2, 6);
    expect(Math.hypot(r.pose.x, r.pose.z)).toBeLessThan(1e-9);
  });

  it('12. waits the requested time', () => {
    const r = run(program([{ op: 'wait', seconds: num(2) }]));
    expect(r.t).toBeGreaterThanOrEqual(2);
    expect(r.t).toBeLessThan(2 + 3 * DT);
  });

  it('13. repeat runs the body the right number of times (a square returns home)', () => {
    const r = run(program([{ op: 'repeat', times: num(4), body: [move(0.2), turn('right', 90)] }]));
    expect(r.events.filter((e) => e.type === 'commandFinished' && e.statement.op === 'move')).toHaveLength(4);
    expect(r.pose.x).toBeCloseTo(0, 5);
    expect(r.pose.z).toBeCloseTo(0, 5);
    expect(normalizeAngle(r.pose.heading)).toBeCloseTo(0, 5);
  });

  it('14. stop ends the program immediately', () => {
    const r = run(program([{ op: 'stop', ...src('st') }, move(1)]));
    expect(r.pose.x).toBe(0);
    expect(r.events.some((e) => e.type === 'finished' && e.reason === 'stopBlock')).toBe(true);
  });

  it('halt stops mid-move', () => {
    const q = new CommandQueue(program([move(1)]), { maxWheelSpeed: 0.5, trackWidth: 0.25 });
    q.start();
    q.update({ dt: DT, pose: { x: 0, z: 0, heading: 0 }, sensors: {} });
    q.halt();
    expect(q.update({ dt: DT, pose: { x: 0.01, z: 0, heading: 0 }, sensors: {} }).wheels).toEqual({ left: 0, right: 0 });
    expect(q.status.state).toBe('finished');
  });

  it('evaluates conditions at runtime with live sensors', () => {
    const d = sensorId('front-distance');
    const cond: Expression = { kind: 'compare', op: '<', left: { kind: 'sensorDistance', sensor: d }, right: num(0.2) };
    // forever { if distance < 0.2 → stop ; move 5 cm }
    const p = program([{ op: 'while', condition: { kind: 'boolean', value: true }, body: [{ op: 'if', condition: cond, then: [{ op: 'stop' }] }, move(0.05)] }]);
    // a wall at x = 1.0
    const r = run(p, { sensors: (pose) => ({ [d]: { kind: 'distance', distance: Math.max(0, 1.0 - pose.x) } }) });
    expect(r.q.status.state).toBe('finished');
    // checked before each 5 cm step: at 0.80 m the distance is exactly 0.20 (not < 0.2), so it stops at 0.85 m
    expect(r.pose.x).toBeCloseTo(0.85, 6);
  });

  it('keeps variables and supports expressions + set speed', () => {
    const p = program(
      [
        { op: 'setVar', name: 'n', value: num(2) },
        { op: 'changeVar', name: 'n', delta: { kind: 'arithmetic', op: '*', left: { kind: 'variable', name: 'n' }, right: num(3) } },
        { op: 'setSpeed', speed: num(1) },
        { op: 'move', direction: 'forward', distance: { kind: 'arithmetic', op: '/', left: { kind: 'variable', name: 'n' }, right: num(40) } },
      ],
      ['n'],
    );
    const r = run(p);
    expect(r.q.status.variables.n).toBe(8);
    expect(r.pose.x).toBeCloseTo(0.2, 6);
  });

  it('reports student-friendly runtime errors with the block', () => {
    const r = run(program([{ op: 'setVar', name: 'x', value: { kind: 'arithmetic', op: '/', left: num(1), right: num(0) }, ...src('bad') }], ['x']));
    const err = r.events.find((e) => e.type === 'error');
    expect(err?.type === 'error' && err.blockId).toBe('bad');
    expect(r.q.status.state).toBe('error');
  });

  it('20. tracks the active block', () => {
    const r = run(program([move(0.1, 'a'), turn('left', 45, 'b'), move(0.1, 'c')]));
    const order = r.active.filter((id, i, arr) => id && id !== arr[i - 1]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('a forever loop without waits yields instead of freezing', () => {
    const p = program([{ op: 'while', condition: { kind: 'boolean', value: true }, body: [{ op: 'changeVar', name: 'n', delta: num(1) }] }], ['n']);
    const q = new CommandQueue(p, { maxWheelSpeed: 0.5, trackWidth: 0.25, statementBudget: 100 });
    q.start();
    q.update({ dt: DT, pose: { x: 0, z: 0, heading: 0 }, sensors: {} });
    expect(q.status.state).toBe('running');
    expect(q.status.variables.n).toBeLessThanOrEqual(100);
  });

  it('is deterministic, including random', () => {
    const p = program([{ op: 'setVar', name: 'r', value: { kind: 'random', min: num(1), max: num(10) } }, { op: 'move', direction: 'forward', distance: { kind: 'arithmetic', op: '/', left: { kind: 'variable', name: 'r' }, right: num(100) } }], ['r']);
    const a = run(p, { seed: 7 });
    const b = run(p, { seed: 7 });
    expect(a.pose).toEqual(b.pose);
    expect(a.q.status.variables.r).toBe(b.q.status.variables.r);
  });
});
