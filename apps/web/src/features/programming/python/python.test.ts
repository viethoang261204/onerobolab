import { ROVER } from '@robolab/robot-engine';
import type { Program, Statement } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { checkStructure, validateProgram } from '../blocks/block-validation';
import { compileProgram } from '../compiler/compiler';
import { generatePython, generatePythonWithLines } from '../generators/python-generator';
import {
  and,
  brk,
  buildProgram,
  call,
  changeVar,
  cmp,
  colorIs,
  distanceBelow,
  drop,
  forever,
  fwd,
  fwdBy,
  getVar,
  goTo,
  ifElse,
  ifThen,
  left,
  lineSeen,
  math,
  mission,
  not,
  obstacle,
  pick,
  repeat,
  right,
  robotX,
  setVar,
  speed,
  stop,
  until,
  waitS,
  whileDo,
  type Spec,
} from '../test-utils';
import { pythonToBlocks } from './python-to-blocks';

/** IR without block ids (blocks are rebuilt, so ids differ). */
const strip = (p: Program): unknown =>
  JSON.parse(JSON.stringify(p, (k, v: unknown) => (k === 'source' ? undefined : v))) as unknown;

const compile = (p: ReturnType<typeof buildProgram>) => {
  const r = compileProgram(p, ROVER);
  if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  return r;
};

function roundTrip(stack: Spec[], variables: string[] = [], functions: Record<string, Spec[]> = {}) {
  const original = buildProgram(stack, variables, functions);
  const code = generatePython(original);
  const parsed = pythonToBlocks(code, original);
  if (!parsed.ok) throw new Error(`line ${parsed.problem.line}: ${parsed.problem.message}\n${code}`);
  expect(checkStructure(parsed.program)).toEqual([]);
  const a = compile(original);
  const b = compile(parsed.program);
  expect(strip(b.program)).toEqual(strip(a.program));
  expect(b.blockCount).toBe(a.blockCount);
  // Stable: generating again gives the same text.
  expect(generatePython(parsed.program)).toBe(code);
  return { code, program: parsed.program };
}

describe('Python ⇄ blocks', () => {
  it('round-trips moves, loops and nested ifs (with elif)', () => {
    const { code } = roundTrip([
      speed(80),
      repeat(4, [fwd(50), left(90)]),
      forever([ifElse(obstacle, [right(90)], [ifElse(colorIs('red'), [stop()], [ifThen(lineSeen, [fwd(5)])])])]),
    ]);
    expect(code).toContain('robot.set_speed(80)\nfor _ in range(4):\n    robot.move_forward(50)\n    robot.turn_left(90)');
    expect(code).toContain('    if robot.obstacle_ahead():\n        robot.turn_right(90)\n    elif robot.color() == "red":\n        robot.stop()\n    elif robot.on_line():');
  });

  it('round-trips variables, maths, comparisons, mission data, positions and go to', () => {
    const { code } = roundTrip(
      [
        setVar('n', 0),
        changeVar('n', -2),
        until(cmp(getVar('n'), '>=', 6), [changeVar('n', 1), fwdBy(math('multiply', getVar('n'), math('add', mission('gap'), 10)))]),
        whileDo(and(not(obstacle), cmp(robotX, '<', 200)), [fwd(5)]),
        goTo(math('subtract', 0, mission('target')), 120),
        ifThen(cmp(mission('target'), '!=', 3), [waitS(1.5)]),
      ],
      ['n'],
    );
    expect(code).toContain('n -= 2');
    expect(code).toContain('while not n >= 6:');
    expect(code).toContain('robot.move_forward(n * (mission.gap + 10))');
    expect(code).toContain('while not robot.obstacle_ahead() and robot.x() < 200:');
    expect(code).toContain('robot.go_to(0 - mission.target, 120)');
  });

  it('round-trips functions, break, pick and drop', () => {
    const { code } = roundTrip([repeat(3, [call('deliver')]), forever([ifThen(distanceBelow(20), [brk()]), fwd(5)]), stop()], [], {
      deliver: [pick(), right(180), fwd(100), drop(), left(180), fwd(100)],
    });
    expect(code).toContain('def deliver():\n    robot.pick_up()');
    expect(code).toContain('for _ in range(3):\n    deliver()');
    expect(code).toContain('        break');
  });

  it('round-trips grid step command', () => {
    const { code } = roundTrip([{ t: 'motion.step', f: { steps: 3 } }, left(90), { t: 'motion.step', f: { steps: 2 } }, stop()]);
    expect(code).toContain('robot.step(3)\nrobot.turn_left(90)\nrobot.step(2)\nrobot.stop()');
  });

  it('builds blocks from hand-written Python', () => {
    const src = [
      'from onerobolab import robot, mission',
      '',
      '# go to the target bay',
      'count = 0',
      'while True:',
      '    if robot.color() == "blue":   # a bay marker',
      '        count += 1',
      '        if count == mission.target:',
      '            break',
      '        robot.move_forward(cm=30)',
      '    robot.move_forward(5)',
      'robot.turn_left(90)',
      'robot.move_forward(80)',
    ].join('\n');
    const r = pythonToBlocks(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(validateProgram(r.program).errors).toBe(0);
    const ir = compile(r.program).program;
    const body = ir.body as readonly Statement[];
    expect(body.map((s) => s.op)).toEqual(['setVar', 'while', 'turn', 'move']);
    expect(r.program.blocks[r.program.blocks.start!.next!]!.comment).toBe('go to the target bay');
    expect(r.program.variables).toEqual(['count']);
  });

  it('explains mistakes with a line number', () => {
    const bad = (src: string) => {
      const r = pythonToBlocks(src);
      return r.ok ? null : r.problem;
    };
    expect(bad('robot.move_forward(10')).toMatchObject({ message: expect.stringContaining('never closed') });
    expect(bad('if robot.on_line()\n    robot.stop()')).toMatchObject({ line: 1, message: expect.stringContaining('“:”') });
    expect(bad('robot.fly()')).toMatchObject({ line: 1, message: expect.stringContaining('no action called “fly”') });
    expect(bad('for i in range(3):\n    robot.move_forward(i)')).toMatchObject({ line: 2, message: expect.stringContaining('loop counter') });
    expect(bad('while True:\nrobot.stop()')).toMatchObject({ line: 2, message: expect.stringContaining('indented') });
    expect(bad('deliver()')).toMatchObject({ message: expect.stringContaining('no function called “deliver”') });
    expect(bad('import os')).toMatchObject({ message: expect.stringContaining('isn’t available') });
    expect(bad('break')).toMatchObject({ message: expect.stringContaining('inside a loop') });
    expect(bad('if robot.color() == 3:\n    pass')).toMatchObject({ message: expect.stringContaining('colour name') });
  });

  it('maps every generated line back to its block', () => {
    const p = buildProgram([fwd(10, 'a'), repeat(2, [right(90, 'c')], 'b')]);
    const { code, blockAt } = generatePythonWithLines(p);
    const lines = code.split('\n');
    expect(blockAt[lines.indexOf('robot.move_forward(10)')]).toBe('a');
    expect(blockAt[lines.indexOf('for _ in range(2):')]).toBe('b');
    expect(blockAt[lines.indexOf('    robot.turn_right(90)')]).toBe('c');
    expect(code).not.toContain('\u0001');
  });
});
