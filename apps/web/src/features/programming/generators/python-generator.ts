import { getBlockDef } from '../blocks/block-registry';
import { START_ID } from '../blocks/block-model';
import type { BlockId, BlockInstance, ProgramState } from '../blocks/block-types';
import { chainIds } from '../blocks/block-utils';

/*
 * Block tree → Python in the OneRoboLab dialect (the `onerobolab` module):
 * `robot.move_forward(cm)`, `robot.distance()`, `mission.target`, `for _ in
 * range(n):`, `def name():` … Reads the same ProgramState as the editor —
 * there is no second program. The Python editor parses this dialect back
 * into blocks (`python/python-to-blocks.ts`), so the two stay round-trip safe.
 */

const INDENT = '    ';
/** Marks the line a block starts on (stripped before the code is shown). */
const MARK = '\u0001';
export const pyIdent = (name: string) => name.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^(\d)/, '_$1') || 'value';

/** Precedence of an expression's top operator (higher binds tighter). */
type Prec = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
const OR: Prec = 1;
const AND: Prec = 2;
const NOT: Prec = 3;
const CMP: Prec = 4;
const ADD: Prec = 5;
const MUL: Prec = 6;
/** Unary minus (negative literals). */
const NEG: Prec = 7;
const ATOM: Prec = 8;

interface Py {
  readonly code: string;
  readonly prec: Prec;
}

const wrap = (e: Py, min: Prec) => (e.prec < min ? `(${e.code})` : e.code);

function numArg(p: ProgramState, b: BlockInstance, name: string): Py {
  const child = b.inputs[name];
  if (child) return expr(p, child);
  const v = b.fields[name];
  return { code: typeof v === 'number' && Number.isFinite(v) ? String(v) : '0', prec: typeof v === 'number' && v < 0 ? NEG : ATOM };
}

const COMPARE: Record<string, string> = { '<': '<', '>': '>', '=': '==', '<=': '<=', '>=': '>=', '!=': '!=' };

function expr(p: ProgramState, id: BlockId | null | undefined): Py {
  const b = id ? p.blocks[id] : undefined;
  if (!b) return { code: 'False', prec: ATOM };
  const bool = (name: string) => expr(p, b.inputs[name]);
  const field = (name: string) => String(b.fields[name] ?? '');
  /** Left-associative binary operator: the right side needs a tighter operator (a - (b - c)). */
  const bin = (op: string, prec: Prec): Py => ({ code: `${wrap(numArg(p, b, 'a'), prec)} ${op} ${wrap(numArg(p, b, 'b'), (prec + 1) as Prec)}`, prec });
  switch (b.type) {
    case 'sensor.distance':
      return { code: 'robot.distance()', prec: ATOM };
    case 'sensor.line':
      return { code: 'robot.on_line()', prec: ATOM };
    case 'sensor.color':
      return { code: `robot.color() == "${field('color')}"`, prec: CMP };
    case 'sensor.obstacle':
      return { code: 'robot.obstacle_ahead()', prec: ATOM };
    case 'sensor.value':
      return { code: `robot.read("${field('sensor')}")`, prec: ATOM };
    case 'sensor.robotX':
      return { code: 'robot.x()', prec: ATOM };
    case 'sensor.robotY':
      return { code: 'robot.y()', prec: ATOM };
    case 'mission.value':
      return { code: `mission.${pyIdent(field('key'))}`, prec: ATOM };
    case 'logic.compare':
      return { code: `${wrap(numArg(p, b, 'a'), ADD)} ${COMPARE[field('op')] ?? '=='} ${wrap(numArg(p, b, 'b'), ADD)}`, prec: CMP };
    case 'logic.and':
      return { code: `${wrap(bool('a'), AND)} and ${wrap(bool('b'), NOT)}`, prec: AND };
    case 'logic.or':
      return { code: `${wrap(bool('a'), OR)} or ${wrap(bool('b'), AND)}`, prec: OR };
    case 'logic.not':
      return { code: `not ${wrap(bool('a'), NOT)}`, prec: NOT };
    case 'math.add':
      return bin('+', ADD);
    case 'math.subtract':
      return bin('-', ADD);
    case 'math.multiply':
      return bin('*', MUL);
    case 'math.divide':
      return bin('/', MUL);
    case 'math.random':
      return { code: `random.randint(${numArg(p, b, 'from').code}, ${numArg(p, b, 'to').code})`, prec: ATOM };
    case 'variable.get':
      return { code: pyIdent(field('name')), prec: ATOM };
    default:
      return { code: 'None', prec: ATOM };
  }
}

function stack(p: ProgramState, head: BlockId | null, depth: number, out: string[]): void {
  const ids = chainIds(p.blocks, head);
  if (ids.length === 0) {
    out.push(INDENT.repeat(depth) + 'pass');
    return;
  }
  for (const id of ids) statement(p, id, depth, out);
}

/** An `if … else` whose else holds exactly one if / if-else becomes `elif`. */
function ifChain(p: ProgramState, b: BlockInstance, depth: number, lines: string[], keyword: 'if' | 'elif') {
  const pad = INDENT.repeat(depth);
  lines.push(`${pad}${keyword} ${expr(p, b.inputs.condition).code}:`);
  stack(p, b.slots.then ?? null, depth + 1, lines);
  if (b.type !== 'control.ifElse') return;
  const elseHead = b.slots.else ?? null;
  const only = elseHead ? p.blocks[elseHead] : undefined;
  if (only && !only.next && !only.disabled && !only.comment && (only.type === 'control.if' || only.type === 'control.ifElse')) {
    ifChain(p, only, depth, lines, 'elif');
    return;
  }
  lines.push(`${pad}else:`);
  stack(p, elseHead, depth + 1, lines);
}

function statement(p: ProgramState, id: BlockId, depth: number, out: string[]): void {
  const b = p.blocks[id];
  if (!b) return;
  const pad = INDENT.repeat(depth);
  if (b.comment) for (const line of b.comment.split('\n')) out.push(`${pad}# ${line}`);
  const lines: string[] = [];
  const body = (slot: string) => stack(p, b.slots[slot] ?? null, depth + 1, lines);
  const n = (name: string) => numArg(p, b, name).code;
  switch (b.type) {
    case 'motion.step':
      lines.push(`${pad}robot.step(${n('steps')})`);
      break;
    case 'motion.forward':
      lines.push(`${pad}robot.move_forward(${n('distance')})`);
      break;
    case 'motion.backward':
      lines.push(`${pad}robot.move_backward(${n('distance')})`);
      break;
    case 'motion.turnLeft':
      lines.push(`${pad}robot.turn_left(${n('angle')})`);
      break;
    case 'motion.turnRight':
      lines.push(`${pad}robot.turn_right(${n('angle')})`);
      break;
    case 'motion.stop':
      lines.push(`${pad}robot.stop()`);
      break;
    case 'motion.speed':
      lines.push(`${pad}robot.set_speed(${n('speed')})`);
      break;
    case 'motion.goTo':
      lines.push(`${pad}robot.go_to(${n('x')}, ${n('y')})`);
      break;
    case 'action.pick':
      lines.push(`${pad}robot.pick_up()`);
      break;
    case 'action.drop':
      lines.push(`${pad}robot.drop()`);
      break;
    case 'control.wait':
      lines.push(`${pad}robot.wait(${n('seconds')})`);
      break;
    case 'control.repeat':
      lines.push(`${pad}for _ in range(${n('count')}):`);
      body('body');
      break;
    case 'control.forever':
      lines.push(`${pad}while True:`);
      body('body');
      break;
    case 'control.while':
      lines.push(`${pad}while ${expr(p, b.inputs.condition).code}:`);
      body('body');
      break;
    case 'control.until':
      lines.push(`${pad}while not ${wrap(expr(p, b.inputs.condition), NOT)}:`);
      body('body');
      break;
    case 'control.break':
      lines.push(`${pad}break`);
      break;
    case 'control.if':
    case 'control.ifElse':
      ifChain(p, b, depth, lines, 'if');
      break;
    case 'variable.set':
      lines.push(`${pad}${pyIdent(String(b.fields.name ?? ''))} = ${n('value')}`);
      break;
    case 'variable.change': {
      const d = numArg(p, b, 'delta');
      const neg = !b.inputs.delta && typeof b.fields.delta === 'number' && b.fields.delta < 0;
      lines.push(`${pad}${pyIdent(String(b.fields.name ?? ''))} ${neg ? '-=' : '+='} ${neg ? String(-(b.fields.delta as number)) : d.code}`);
      break;
    }
    case 'function.call':
      lines.push(`${pad}${pyIdent(String(b.fields.name ?? ''))}()`);
      break;
    default:
      lines.push(`${pad}# ${getBlockDef(b.type).help}`);
  }
  if (b.disabled) out.push(...lines.map((l) => `${pad}# (disabled) ${l.trimStart()}`));
  else {
    if (lines[0] !== undefined) lines[0] += MARK + id;
    out.push(...lines);
  }
}

/** Generate the Python for a program: functions first, then the main script. */
export function generatePython(p: ProgramState): string {
  return generatePythonWithLines(p).code;
}

/** The Python plus, for every line, the block it comes from (null for structure / comments). */
export function generatePythonWithLines(p: ProgramState): { code: string; blockAt: (BlockId | null)[] } {
  const raw = generateMarked(p).split('\n');
  const blockAt: (BlockId | null)[] = [];
  const lines = raw.map((l) => {
    const k = l.indexOf(MARK);
    blockAt.push(k >= 0 ? l.slice(k + 1) : null);
    return k >= 0 ? l.slice(0, k) : l;
  });
  return { code: lines.join('\n'), blockAt };
}

function generateMarked(p: ProgramState): string {
  const out: string[] = ['from onerobolab import robot, mission', 'import random', ''];
  for (const root of p.roots.slice(1)) {
    const head = p.blocks[root.id];
    if (head?.type !== 'function.define') continue;
    out.push(`def ${pyIdent(String(head.fields.name ?? ''))}():`);
    stack(p, head.next, 1, out);
    out.push('');
  }
  stack(p, p.blocks[START_ID]?.next ?? null, 0, out);

  for (const root of p.roots.slice(1)) {
    const head = p.blocks[root.id];
    if (!head || head.type === 'function.define') continue;
    out.push('');
    if (head.type === 'event.button' || head.type === 'event.sensor') {
      const what = String(head.fields.button ?? head.fields.sensor ?? '');
      out.push(`# when ${head.type === 'event.button' ? `button ${what} is pressed` : `the ${what} sensor detects something`} (not supported in Python yet):`);
      const tmp: string[] = [];
      stack(p, head.next, 0, tmp);
      out.push(...tmp.map((l) => `# ${l}`));
    } else if (!getBlockDef(head.type).output) {
      out.push('# not connected to the start block (will not run):');
      const tmp: string[] = [];
      stack(p, root.id, 0, tmp);
      out.push(...tmp.map((l) => `# ${l}`));
    }
  }
  return out.join('\n') + '\n';
}
