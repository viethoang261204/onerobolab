import type { Expression, Pose2D, Program, Statement } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { ROVER } from '../catalog.ts';
import { stepDifferentialDrive } from '../kinematics.ts';
import { CommandQueue, GRIP_SECONDS, type CommandQueueOptions } from './command-queue.ts';

const DT = 1 / 60;
const num = (value: number): Expression => ({ kind: 'number', value });
const fwd = (m: number): Statement => ({ op: 'move', direction: 'forward', distance: num(m) });
const program = (body: Statement[], variables: string[] = []): Program => ({ irVersion: 1, variables, body });

function run(p: Program, opts: Partial<CommandQueueOptions> = {}, start: Pose2D = { x: 0, z: 0, heading: 0 }) {
  const q = new CommandQueue(p, { maxWheelSpeed: ROVER.maxWheelSpeed, trackWidth: ROVER.wheelBase, ...opts });
  q.start();
  let pose = start;
  let t = 0;
  for (; t < 60 && (q.status.state === 'running' || q.status.state === 'idle'); t += DT) {
    const out = q.update({ dt: DT, pose, sensors: {} });
    pose = stepDifferentialDrive(pose, out.wheels, ROVER.wheelBase, DT).pose;
  }
  return { q, pose, t };
}

describe('CommandQueue — new statements', () => {
  it('break leaves the innermost loop only', () => {
    // forever { n += 1; if n == 3 → break } ; move 0.1
    const n: Expression = { kind: 'variable', name: 'n' };
    const r = run(
      program(
        [
          {
            op: 'while',
            condition: { kind: 'boolean', value: true },
            body: [{ op: 'changeVar', name: 'n', delta: num(1) }, { op: 'if', condition: { kind: 'compare', op: '==', left: n, right: num(3) }, then: [{ op: 'break' }] }],
          },
          fwd(0.1),
        ],
        ['n'],
      ),
    );
    expect(r.q.status.variables.n).toBe(3);
    expect(r.pose.x).toBeCloseTo(0.1, 6);
    expect(r.q.status.state).toBe('finished');
  });

  it('go to turns towards the point and drives straight to it (y = −z)', () => {
    const r = run(program([{ op: 'goTo', x: num(0.3), y: num(0.4) }]));
    expect(r.pose.x).toBeCloseTo(0.3, 4);
    expect(r.pose.z).toBeCloseTo(-0.4, 4);
  });

  it('mission data and the robot position can be read', () => {
    const r = run(
      program([{ op: 'move', direction: 'forward', distance: { kind: 'missionData', key: 'gap' } }, { op: 'setVar', name: 'x', value: { kind: 'robotX' } }], ['x']),
      { data: { gap: 0.25 } },
      { x: 1, z: 0, heading: 0 },
    );
    expect(r.q.status.variables.x).toBeCloseTo(1.25, 6);
    const missing = run(program([{ op: 'move', direction: 'forward', distance: { kind: 'missionData', key: 'nope' }, source: { blockId: 'b' } }]));
    expect(missing.q.status.state).toBe('error');
    expect(missing.q.status.error).toContain('nope');
  });

  it('pick and drop ask the world, take a moment, and report problems on their block', () => {
    const calls: string[] = [];
    const ok = run(program([{ op: 'pick' }, { op: 'drop' }]), { interact: (a) => (calls.push(a), null) });
    expect(calls).toEqual(['pick', 'drop']);
    expect(ok.t).toBeGreaterThanOrEqual(2 * GRIP_SECONDS - 2 * DT);
    const bad = run(program([{ op: 'pick', source: { blockId: 'p' } }]), { interact: () => 'There is no crate in front of the robot.' });
    expect(bad.q.status).toMatchObject({ state: 'error', activeBlockId: 'p', error: 'There is no crate in front of the robot.' });
  });
});
