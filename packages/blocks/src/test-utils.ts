import { START_ID } from './block-model.ts';
import type { BlockId, BlockInstance, BlockType, FieldValue, ProgramState } from './block-types.ts';
import { createBlock } from './block-utils.ts';

/** Compact block-program description for tests. */
export interface Spec {
  readonly t: BlockType;
  readonly f?: Readonly<Record<string, FieldValue>>;
  readonly slots?: Readonly<Record<string, readonly Spec[]>>;
  readonly inputs?: Readonly<Record<string, Spec>>;
  readonly id?: string;
}

/** Build a ProgramState: `when program starts` followed by `stack` (plus “define …” scripts for `functions`). */
export function buildProgram(stack: readonly Spec[], variables: readonly string[] = ['score'], functions: Readonly<Record<string, readonly Spec[]>> = {}): ProgramState {
  const blocks: Record<BlockId, BlockInstance> = {};
  const make = (s: Spec): BlockId => {
    const base = createBlock(s.t, variables, s.id);
    const inputs = { ...base.inputs };
    for (const [k, v] of Object.entries(s.inputs ?? {})) inputs[k] = make(v);
    const slots = { ...base.slots };
    for (const [k, v] of Object.entries(s.slots ?? {})) slots[k] = chain(v);
    blocks[base.id] = { ...base, fields: { ...base.fields, ...s.f }, inputs, slots };
    return base.id;
  };
  const chain = (list: readonly Spec[]): BlockId | null => {
    const ids = list.map(make);
    ids.forEach((id, i) => {
      const b = blocks[id];
      if (b) blocks[id] = { ...b, next: ids[i + 1] ?? null };
    });
    return ids[0] ?? null;
  };
  const head = chain(stack);
  blocks[START_ID] = { ...createBlock('event.start', [], START_ID), next: head };
  const roots = [{ id: START_ID, x: 0, y: 0 }];
  Object.entries(functions).forEach(([name, body], i) => {
    const def = createBlock('function.define', variables);
    blocks[def.id] = { ...def, fields: { name }, next: chain(body) };
    roots.push({ id: def.id, x: 500, y: i * 300 });
  });
  return { version: 1, blocks, roots, variables };
}

export const step = (n: number, id?: string): Spec => ({ t: 'motion.step', f: { steps: n }, ...(id && { id }) });
export const fwd = (cm: number, id?: string): Spec => ({ t: 'motion.forward', f: { distance: cm }, ...(id && { id }) });
export const back = (cm: number): Spec => ({ t: 'motion.backward', f: { distance: cm } });
export const right = (deg: number, id?: string): Spec => ({ t: 'motion.turnRight', f: { angle: deg }, ...(id && { id }) });
export const left = (deg: number, id?: string): Spec => ({ t: 'motion.turnLeft', f: { angle: deg }, ...(id && { id }) });
export const stop = (id?: string): Spec => ({ t: 'motion.stop', ...(id && { id }) });
export const repeat = (n: number, body: readonly Spec[], id?: string): Spec => ({ t: 'control.repeat', f: { count: n }, slots: { body }, ...(id && { id }) });
export const forever = (body: readonly Spec[]): Spec => ({ t: 'control.forever', slots: { body } });
export const ifThen = (condition: Spec, then: readonly Spec[], id?: string): Spec => ({ t: 'control.if', inputs: { condition }, slots: { then }, ...(id && { id }) });
export const distanceBelow = (cm: number): Spec => ({ t: 'logic.compare', f: { op: '<', b: cm }, inputs: { a: { t: 'sensor.distance' } } });
export const obstacle: Spec = { t: 'sensor.obstacle' };
export const ifElse = (condition: Spec, then: readonly Spec[], otherwise: readonly Spec[]): Spec => ({ t: 'control.ifElse', inputs: { condition }, slots: { then, else: otherwise } });
export const lineSeen: Spec = { t: 'sensor.line' };
export const colorIs = (color: string): Spec => ({ t: 'sensor.color', f: { color } });
export const speed = (percent: number): Spec => ({ t: 'motion.speed', f: { speed: percent } });
export const setVar = (name: string, value: number): Spec => ({ t: 'variable.set', f: { name, value } });
export const changeVar = (name: string, delta: number): Spec => ({ t: 'variable.change', f: { name, delta } });
export const getVar = (name: string): Spec => ({ t: 'variable.get', f: { name } });
/** Move forward by a reporter (e.g. a variable). */
export const fwdBy = (value: Spec): Spec => ({ t: 'motion.forward', inputs: { distance: value } });
/** `variable = n` (a yes/no block for if / if-else). */
export const varIs = (name: string, n: number): Spec => ({ t: 'logic.compare', f: { op: '=', b: n }, inputs: { a: getVar(name) } });
/** The standard detour round an obstacle: left, out, right, past, right, back, left. */
export const detour = (out: number, past: number): Spec[] => [left(90), fwd(out), right(90), fwd(past), right(90), fwd(out), left(90)];

// ── Blocks added for the full Starter Island curriculum ──
export const waitS = (seconds: number): Spec => ({ t: 'control.wait', f: { seconds } });
export const whileDo = (condition: Spec, body: readonly Spec[]): Spec => ({ t: 'control.while', inputs: { condition }, slots: { body } });
export const until = (condition: Spec, body: readonly Spec[]): Spec => ({ t: 'control.until', inputs: { condition }, slots: { body } });
export const brk = (): Spec => ({ t: 'control.break' });
export const pick = (): Spec => ({ t: 'action.pick' });
export const drop = (): Spec => ({ t: 'action.drop' });
export const goTo = (x: number | Spec, y: number | Spec): Spec => ({
  t: 'motion.goTo',
  f: { ...(typeof x === 'number' && { x }), ...(typeof y === 'number' && { y }) },
  inputs: { ...(typeof x !== 'number' && { x }), ...(typeof y !== 'number' && { y }) },
});
export const mission = (key: string): Spec => ({ t: 'mission.value', f: { key } });
export const robotX: Spec = { t: 'sensor.robotX' };
export const robotY: Spec = { t: 'sensor.robotY' };
export const call = (name: string): Spec => ({ t: 'function.call', f: { name } });
export const not = (a: Spec): Spec => ({ t: 'logic.not', inputs: { a } });
export const and = (a: Spec, b: Spec): Spec => ({ t: 'logic.and', inputs: { a, b } });
export const or = (a: Spec, b: Spec): Spec => ({ t: 'logic.or', inputs: { a, b } });
/** `a op b` where each side is a number or a value block. */
export const cmp = (a: number | Spec, op: '<' | '>' | '=' | '<=' | '>=' | '!=', b: number | Spec): Spec => ({
  t: 'logic.compare',
  f: { op, ...(typeof a === 'number' && { a }), ...(typeof b === 'number' && { b }) },
  inputs: { ...(typeof a !== 'number' && { a }), ...(typeof b !== 'number' && { b }) },
});
/** A number block: a + b, a - b, a × b, a ÷ b. */
export const math = (op: 'add' | 'subtract' | 'multiply' | 'divide', a: number | Spec, b: number | Spec): Spec => ({
  t: `math.${op}`,
  f: { ...(typeof a === 'number' && { a }), ...(typeof b === 'number' && { b }) },
  inputs: { ...(typeof a !== 'number' && { a }), ...(typeof b !== 'number' && { b }) },
});
/** Set a variable to a value block. */
export const setVarTo = (name: string, value: Spec): Spec => ({ t: 'variable.set', f: { name }, inputs: { value } });
/** Move / turn by a value block. */
export const backBy = (value: Spec): Spec => ({ t: 'motion.backward', inputs: { distance: value } });
export const leftBy = (value: Spec): Spec => ({ t: 'motion.turnLeft', inputs: { angle: value } });
export const rightBy = (value: Spec): Spec => ({ t: 'motion.turnRight', inputs: { angle: value } });
export const repeatBy = (count: Spec, body: readonly Spec[]): Spec => ({ t: 'control.repeat', inputs: { count }, slots: { body } });
export const waitBy = (seconds: Spec): Spec => ({ t: 'control.wait', inputs: { seconds } });
