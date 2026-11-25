import { ROVER } from '@robolab/robot-engine';
import type { Program, Statement } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { buildProgram, distanceBelow, fwd, ifThen, repeat, right, stop, type Spec } from './test-utils.ts';
import { compileProgram } from './compiler.ts';

function compile(stack: Spec[], variables?: string[]): Program {
  const r = compileProgram(buildProgram(stack, variables), ROVER);
  if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  return r.program;
}
const first = (p: Program): Statement => p.body[0] as Statement;

describe('block compiler', () => {
  it('1. move forward compiles to metres', () => {
    const s = first(compile([fwd(30, 'm1')]));
    expect(s).toMatchObject({ op: 'move', direction: 'forward', distance: { kind: 'number', value: 0.3 }, source: { blockId: 'm1' } });
  });

  it('2. turn compiles to radians', () => {
    const s = first(compile([right(90)]));
    expect(s.op).toBe('turn');
    if (s.op === 'turn') {
      expect(s.direction).toBe('right');
      expect(s.angle).toMatchObject({ kind: 'number' });
      expect(s.angle.kind === 'number' && s.angle.value).toBeCloseTo(Math.PI / 2, 12);
    }
  });

  it('3. stop compiles', () => {
    expect(first(compile([stop()])).op).toBe('stop');
  });

  it('4. repeat stays a runtime loop (not expanded)', () => {
    const p = compile([repeat(3, [fwd(20), right(120)])]);
    expect(p.body).toHaveLength(1);
    expect(first(p)).toMatchObject({ op: 'repeat', times: { kind: 'number', value: 3 } });
    const s = first(p);
    expect(s.op === 'repeat' && s.body.map((b) => b.op)).toEqual(['move', 'turn']);
  });

  it('5. nested repeat compiles', () => {
    const s = first(compile([repeat(2, [repeat(3, [fwd(10)])])]));
    expect(s.op === 'repeat' && s.body[0]?.op).toBe('repeat');
  });

  it('6. if compiles to a runtime condition on the sensor (cm → m)', () => {
    const s = first(compile([ifThen(distanceBelow(20), [stop()])]));
    expect(s).toMatchObject({
      op: 'if',
      condition: { kind: 'compare', op: '<', left: { kind: 'arithmetic', op: '*', left: { kind: 'sensorDistance' }, right: { kind: 'number', value: 100 } }, right: { kind: 'number', value: 20 } },
    });
  });

  it('7. variables compile', () => {
    const p = compile([
      { t: 'variable.set', f: { name: 'score', value: 5 } },
      { t: 'variable.change', f: { name: 'score', delta: 2 } },
    ]);
    expect(p.variables).toEqual(['score']);
    expect(p.body.map((s) => s.op)).toEqual(['setVar', 'changeVar']);
  });

  it('8. expressions compile (variable + random + math)', () => {
    const p = compile([
      { t: 'variable.set', f: { name: 'score' }, inputs: { value: { t: 'math.random', f: { from: 1, to: 10 } } } },
      { t: 'motion.forward', inputs: { distance: { t: 'math.add', f: { b: 10 }, inputs: { a: { t: 'variable.get', f: { name: 'score' } } } } } },
      { t: 'motion.speed', f: { speed: 80 } },
    ]);
    expect(p.body[0]).toMatchObject({ op: 'setVar', value: { kind: 'random' } });
    // distance = (score + 10) × 0.01 m
    expect(p.body[1]).toMatchObject({ op: 'move', distance: { kind: 'arithmetic', op: '*', left: { kind: 'arithmetic', op: '+' }, right: { kind: 'number', value: 0.01 } } });
    expect(p.body[2]).toMatchObject({ op: 'setSpeed', speed: { kind: 'number', value: 0.8 } });
  });

  it('9. invalid programs are rejected with the offending block', () => {
    const r = compileProgram(buildProgram([{ t: 'control.if', id: 'bad-if', slots: { then: [stop()] } }]), ROVER);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.severity === 'error' && d.blockId === 'bad-if')).toBe(true);
    const r2 = compileProgram(buildProgram([{ t: 'motion.forward', id: 'empty', f: { distance: '' } }]), ROVER);
    expect(r2.ok).toBe(false);
  });

  it('skips disabled blocks and counts compiled blocks', () => {
    const program = buildProgram([fwd(10, 'a'), fwd(20, 'b')]);
    const off = { ...program, blocks: { ...program.blocks, b: { ...program.blocks.b!, disabled: true } } };
    const r = compileProgram(off, ROVER);
    expect(r.ok && r.program.body).toHaveLength(1);
    expect(r.ok && r.blockCount).toBe(1);
  });
});
