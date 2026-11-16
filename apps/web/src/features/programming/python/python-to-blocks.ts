import { START_ID } from '../blocks/block-model';
import type { BlockId, BlockInstance, BlockType, ProgramState, RootPlacement } from '../blocks/block-types';
import { createBlock } from '../blocks/block-utils';
import { FUNCTION_NAME } from '../blocks/block-validation';
import { parse, PythonError, type Expr, type Stmt } from './python-parser';

/*
 * OneRoboLab Python → the block program (the single source of truth). The
 * Python editor never runs code: it rebuilds the blocks from the text, and
 * the normal compiler turns the blocks into IR. `generatePython` is the
 * inverse, so the two views always describe the same program.
 */

export interface PythonProblem {
  readonly line: number;
  readonly message: string;
}

export type PythonResult =
  | { readonly ok: true; readonly program: ProgramState; /** First source line of every block. */ readonly lineOf: ReadonlyMap<BlockId, number> }
  | { readonly ok: false; readonly problem: PythonProblem };

const COLORS = new Set(['red', 'green', 'blue', 'yellow', 'black', 'white']);

/** `robot.<name>(…)` statements: block type, argument fields in order. */
const ACTIONS: Readonly<Record<string, { type: BlockType; args: readonly string[] }>> = {
  step: { type: 'motion.step', args: ['steps'] },
  move_forward: { type: 'motion.forward', args: ['distance'] },
  move_backward: { type: 'motion.backward', args: ['distance'] },
  turn_left: { type: 'motion.turnLeft', args: ['angle'] },
  turn_right: { type: 'motion.turnRight', args: ['angle'] },
  stop: { type: 'motion.stop', args: [] },
  set_speed: { type: 'motion.speed', args: ['speed'] },
  wait: { type: 'control.wait', args: ['seconds'] },
  go_to: { type: 'motion.goTo', args: ['x', 'y'] },
  pick_up: { type: 'action.pick', args: [] },
  pick: { type: 'action.pick', args: [] },
  drop: { type: 'action.drop', args: [] },
};

/** `robot.<name>()` values that are numbers / yes-no answers. */
const NUMBER_SENSORS: Readonly<Record<string, BlockType>> = { distance: 'sensor.distance', x: 'sensor.robotX', y: 'sensor.robotY' };
const BOOL_SENSORS: Readonly<Record<string, BlockType>> = { obstacle_ahead: 'sensor.obstacle', on_line: 'sensor.line' };

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends Readonly<Record<string, infer V>> ? Record<string, V> : T[K] };
type Draft = Mutable<BlockInstance>;

const fail = (message: string, line: number): never => {
  throw new PythonError(message, line);
};

const robotCall = (e: Expr): { name: string; args: readonly Expr[] } | null =>
  e.k === 'call' && e.fn.k === 'attr' && e.fn.obj.k === 'name' && e.fn.obj.v === 'robot' ? { name: e.fn.name, args: e.args } : null;

const isColorRead = (e: Expr) => {
  const c = robotCall(e);
  return !!c && c.name === 'color' && c.args.length === 0;
};

/** Every name an expression / statement list reads (to catch a `for i` counter being used). */
function usesName(stmts: readonly Stmt[], name: string): number | null {
  const inExpr = (e: Expr): boolean => {
    switch (e.k) {
      case 'name':
        return e.v === name;
      case 'attr':
        return inExpr(e.obj);
      case 'call':
        return inExpr(e.fn) || e.args.some(inExpr);
      case 'neg':
      case 'not':
        return inExpr(e.e);
      case 'bin':
      case 'cmp':
      case 'logic':
        return inExpr(e.l) || inExpr(e.r);
      default:
        return false;
    }
  };
  for (const s of stmts) {
    const hit =
      (s.k === 'expr' && inExpr(s.e)) ||
      (s.k === 'assign' && (s.name === name || inExpr(s.value))) ||
      (s.k === 'if' && (s.branches.some((b) => inExpr(b.cond) || usesName(b.body, name) !== null) || (s.orelse && usesName(s.orelse, name) !== null))) ||
      (s.k === 'while' && (inExpr(s.cond) || usesName(s.body, name) !== null)) ||
      (s.k === 'for' && (inExpr(s.count) || usesName(s.body, name) !== null));
    if (hit) return s.line;
  }
  return null;
}

/**
 * Parse Python and build the equivalent block program. `previous` keeps the
 * start block's position and the variable list stable across edits.
 */
export function pythonToBlocks(source: string, previous?: ProgramState): PythonResult {
  try {
    return { ok: true, ...build(parse(source), previous) };
  } catch (e) {
    if (e instanceof PythonError) return { ok: false, problem: { line: e.line, message: e.message } };
    throw e;
  }
}

function build(stmts: readonly Stmt[], previous?: ProgramState): { program: ProgramState; lineOf: Map<BlockId, number> } {
  const blocks: Record<BlockId, Draft> = {};
  const lineOf = new Map<BlockId, number>();
  const variables: string[] = [...(previous?.variables ?? [])];
  const useVar = (name: string, line: number) => {
    if (name === 'robot' || name === 'mission' || name === 'random') fail(`“${name}” is a module — use it like ${name}.something.`, line);
    if (!variables.includes(name)) variables.push(name);
    return name;
  };
  const defs = new Set<string>();
  for (const s of stmts) if (s.k === 'def') defs.add(s.name);

  const make = (type: BlockType, line: number, comment?: string): Draft => {
    const b = createBlock(type, variables) as Draft;
    blocks[b.id] = b;
    lineOf.set(b.id, line);
    if (comment) b.comment = comment;
    return b;
  };

  // ── values ──
  /** Put a number into a block's number argument: a literal in the field, anything else as a value block. */
  const setNum = (b: Draft, arg: string, e: Expr) => {
    if (e.k === 'num') {
      b.fields[arg] = e.v;
      b.inputs[arg] = null;
    } else b.inputs[arg] = numberBlock(e);
  };

  const numberBlock = (e: Expr): BlockId => {
    switch (e.k) {
      case 'name': {
        if (defs.has(e.v)) fail(`“${e.v}” is a function — run it on its own line: ${e.v}()`, e.line);
        const b = make('variable.get', e.line);
        b.fields.name = useVar(e.v, e.line);
        return b.id;
      }
      case 'attr':
        if (e.obj.k === 'name' && e.obj.v === 'mission') {
          const b = make('mission.value', e.line);
          b.fields.key = e.name;
          return b.id;
        }
        if (e.obj.k === 'name' && e.obj.v === 'robot') return fail(`Add brackets to read the robot: robot.${e.name}()`, e.line);
        return fail('Only mission.<name> values can be read this way.', e.line);
      case 'call': {
        const rc = robotCall(e);
        if (rc) {
          const type = NUMBER_SENSORS[rc.name];
          if (type) {
            if (rc.args.length) fail(`robot.${rc.name}() takes no inputs.`, e.line);
            return make(type, e.line).id;
          }
          if (rc.name === 'color') return fail('robot.color() is a colour, not a number — compare it: robot.color() == "red"', e.line);
          if (BOOL_SENSORS[rc.name]) return fail(`robot.${rc.name}() is a yes/no answer, not a number.`, e.line);
          return fail(`robot.${rc.name}() doesn’t give a number.`, e.line);
        }
        if (e.fn.k === 'attr' && e.fn.obj.k === 'name' && e.fn.obj.v === 'random' && e.fn.name === 'randint') {
          if (e.args.length !== 2) fail('random.randint needs two numbers: random.randint(1, 6)', e.line);
          const b = make('math.random', e.line);
          setNum(b, 'from', e.args[0]!);
          setNum(b, 'to', e.args[1]!);
          return b.id;
        }
        if (e.fn.k === 'name' && defs.has(e.fn.v)) return fail(`Functions don’t give back a value — run ${e.fn.v}() on its own line.`, e.line);
        return fail('This doesn’t give a number.', e.line);
      }
      case 'bin': {
        const type: BlockType = e.op === '+' ? 'math.add' : e.op === '-' ? 'math.subtract' : e.op === '*' ? 'math.multiply' : 'math.divide';
        const b = make(type, e.line);
        setNum(b, 'a', e.l);
        setNum(b, 'b', e.r);
        return b.id;
      }
      case 'neg': {
        const b = make('math.subtract', e.line);
        b.fields.a = 0;
        setNum(b, 'b', e.e);
        return b.id;
      }
      case 'str':
        return fail(`“${e.v}” is text — a number is needed here.`, e.line);
      default:
        return fail('A number is needed here, not a yes/no answer.', e.line);
    }
  };

  const boolBlock = (e: Expr): BlockId => {
    switch (e.k) {
      case 'call': {
        const rc = robotCall(e);
        const type = rc ? BOOL_SENSORS[rc.name] : undefined;
        if (rc && type) {
          if (rc.args.length) fail(`robot.${rc.name}() takes no inputs.`, e.line);
          return make(type, e.line).id;
        }
        return fail('This isn’t a yes/no question. Compare it, e.g. robot.distance() < 30', e.line);
      }
      case 'cmp': {
        const colorSide = isColorRead(e.l) ? e.r : isColorRead(e.r) ? e.l : null;
        if (colorSide) {
          if (colorSide.k !== 'str' || !COLORS.has(colorSide.v)) fail('Compare the colour with a colour name, e.g. robot.color() == "red"', e.line);
          if (e.op !== '==' && e.op !== '!=') fail('Colours can only be compared with == or !=.', e.line);
          const c = make('sensor.color', e.line);
          c.fields.color = (colorSide as { v: string }).v;
          if (e.op === '==') return c.id;
          const n = make('logic.not', e.line);
          n.inputs.a = c.id;
          return n.id;
        }
        const b = make('logic.compare', e.line);
        setNum(b, 'a', e.l);
        b.fields.op = e.op === '==' ? '=' : e.op;
        setNum(b, 'b', e.r);
        return b.id;
      }
      case 'logic': {
        const b = make(e.op === 'and' ? 'logic.and' : 'logic.or', e.line);
        b.inputs.a = boolBlock(e.l);
        b.inputs.b = boolBlock(e.r);
        return b.id;
      }
      case 'not': {
        const b = make('logic.not', e.line);
        b.inputs.a = boolBlock(e.e);
        return b.id;
      }
      case 'bool':
        return fail(e.v ? 'Use “while True:” for a loop that never ends; an “if” needs a real question.' : 'This condition is never true.', e.line);
      case 'name':
        return fail(`“${e.v}” is a number. Ask a question about it, e.g. ${e.v} > 0`, e.line);
      default:
        return fail('A yes/no question is needed here, e.g. robot.distance() < 30', e.line);
    }
  };

  // ── statements ──
  /** Convert a statement list; returns the head block id of the chain. */
  const chain = (list: readonly Stmt[], inLoop: boolean): BlockId | null => {
    const ids: BlockId[] = [];
    for (const s of list) {
      const id = statement(s, inLoop);
      if (id) ids.push(id);
    }
    for (let k = 0; k + 1 < ids.length; k++) blocks[ids[k]!]!.next = ids[k + 1]!;
    return ids[0] ?? null;
  };

  const statement = (s: Stmt, inLoop: boolean): BlockId | null => {
    const comment = s.comment;
    switch (s.k) {
      case 'pass':
        return null;
      case 'break': {
        if (!inLoop) fail('“break” only works inside a loop.', s.line);
        return make('control.break', s.line, comment).id;
      }
      case 'def':
        return fail('Define functions at the top level, not inside other code.', s.line);
      case 'assign': {
        const name = useVar(s.name, s.line);
        if (s.op === '=') {
          const b = make('variable.set', s.line, comment);
          b.fields.name = name;
          setNum(b, 'value', s.value);
          return b.id;
        }
        const b = make('variable.change', s.line, comment);
        b.fields.name = name;
        if (s.op === '+=') setNum(b, 'delta', s.value);
        else if (s.value.k === 'num') b.fields.delta = -s.value.v;
        else {
          const neg = make('math.subtract', s.line);
          neg.fields.a = 0;
          setNum(neg, 'b', s.value);
          b.inputs.delta = neg.id;
        }
        return b.id;
      }
      case 'expr': {
        const e = s.e;
        if (e.k === 'call' && e.fn.k === 'name') {
          if (!defs.has(e.fn.v)) {
            if (e.fn.v === 'print') fail('print() isn’t available — the console shows what the robot does.', s.line);
            fail(`There is no function called “${e.fn.v}”. Define it first: def ${e.fn.v}():`, s.line);
          }
          if (e.args.length) fail('Functions here don’t take inputs — use variables instead.', s.line);
          const b = make('function.call', s.line, comment);
          b.fields.name = e.fn.v;
          return b.id;
        }
        const rc = robotCall(e);
        if (!rc) return fail('This line doesn’t do anything — call a robot action, e.g. robot.move_forward(20)', s.line);
        const action = ACTIONS[rc.name];
        if (!action) {
          if (NUMBER_SENSORS[rc.name] || BOOL_SENSORS[rc.name] || rc.name === 'color') fail(`robot.${rc.name}() only reads a sensor — use it in an if, a while or a variable.`, s.line);
          fail(`The robot has no action called “${rc.name}”.`, s.line);
        }
        if (rc.args.length !== action!.args.length) fail(`robot.${rc.name}() needs ${action!.args.length === 0 ? 'no inputs' : `${action!.args.length} input${action!.args.length > 1 ? 's' : ''}`}.`, s.line);
        const b = make(action!.type, s.line, comment);
        action!.args.forEach((arg, k) => setNum(b, arg, rc.args[k]!));
        return b.id;
      }
      case 'if': {
        const build = (k: number): BlockId => {
          const br = s.branches[k]!;
          const last = k === s.branches.length - 1;
          const b = make(last && !s.orelse ? 'control.if' : 'control.ifElse', k === 0 ? s.line : br.cond.line, k === 0 ? comment : undefined);
          b.inputs.condition = boolBlock(br.cond);
          b.slots.then = chain(br.body, inLoop);
          if (!last) b.slots.else = build(k + 1);
          else if (s.orelse) b.slots.else = chain(s.orelse, inLoop);
          return b.id;
        };
        return build(0);
      }
      case 'while': {
        if (s.cond.k === 'bool' && s.cond.v) {
          const b = make('control.forever', s.line, comment);
          b.slots.body = chain(s.body, true);
          return b.id;
        }
        const until = s.cond.k === 'not';
        const b = make(until ? 'control.until' : 'control.while', s.line, comment);
        b.inputs.condition = boolBlock(until ? (s.cond as { e: Expr }).e : s.cond);
        b.slots.body = chain(s.body, true);
        return b.id;
      }
      case 'for': {
        if (s.varName !== '_') {
          const used = usesName(s.body, s.varName);
          if (used !== null) fail(`The loop counter “${s.varName}” can’t be used inside the loop — make your own variable and add 1 to it.`, used);
        }
        const b = make('control.repeat', s.line, comment);
        setNum(b, 'count', s.count);
        b.slots.body = chain(s.body, true);
        return b.id;
      }
    }
  };

  // Main script and functions.
  const startPos = previous?.roots[0] ?? { id: START_ID, x: 40, y: 40 };
  const start = createBlock('event.start', variables, START_ID) as Draft;
  blocks[START_ID] = start;
  const roots: RootPlacement[] = [{ id: START_ID, x: startPos.x, y: startPos.y }];
  const main = stmts.filter((s) => s.k !== 'def');
  start.next = chain(main, false);
  let y = startPos.y;
  for (const s of stmts) {
    if (s.k !== 'def') continue;
    if (!FUNCTION_NAME.test(s.name)) fail('Function names use letters, digits and _ and start with a letter.', s.line);
    if (roots.some((r) => blocks[r.id]?.type === 'function.define' && blocks[r.id]?.fields.name === s.name)) fail(`There are two functions called “${s.name}”.`, s.line);
    const d = make('function.define', s.line, s.comment);
    d.fields.name = s.name;
    d.next = chain(s.body, false);
    roots.push({ id: d.id, x: startPos.x + 460, y });
    y += 80 + 42 * countLines(s.body);
  }
  return { program: { version: 1, blocks: blocks as Record<BlockId, BlockInstance>, roots, variables }, lineOf };
}

/** Rough height of a function's blocks (rows), to stack function scripts without overlap. */
function countLines(stmts: readonly Stmt[]): number {
  let n = 0;
  for (const s of stmts) {
    n += 1;
    if (s.k === 'if') n += s.branches.reduce((k, b) => k + countLines(b.body) + 1, 0) + (s.orelse ? countLines(s.orelse) + 1 : 0);
    else if (s.k === 'while' || s.k === 'for') n += countLines(s.body) + 1;
  }
  return n;
}
