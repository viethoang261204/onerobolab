import type { CompareOperator, Expression, RobotDefinition, SensorColor, SensorId, SensorKind } from '@robolab/shared';
import { getBlockDef } from './block-registry.ts';
import type { BlockId, BlockInstance, ProgramState } from './block-types.ts';
import { CompileProblem } from './compiler-errors.ts';

export interface ExprContext {
  readonly program: ProgramState;
  readonly robot: RobotDefinition;
  /** Counts compiled blocks (value blocks included). */
  count: (id: BlockId) => void;
}

const num = (value: number): Expression => ({ kind: 'number', value });
const scale = (e: Expression, factor: number): Expression =>
  factor === 1 ? e : e.kind === 'number' ? num(e.value * factor) : { kind: 'arithmetic', op: '*', left: e, right: num(factor) };

function sensorOf(ctx: ExprContext, kind: SensorKind, blockId: BlockId): SensorId {
  const mount = ctx.robot.sensors.find((s) => s.kind === kind);
  if (!mount) throw new CompileProblem(`This robot has no ${kind} sensor.`, blockId);
  return mount.id;
}

/** A value block (reporter / boolean) → IR expression. */
export function compileValueBlock(ctx: ExprContext, id: BlockId): Expression {
  const b = ctx.program.blocks[id];
  if (!b) throw new CompileProblem('A value block is missing.', id);
  ctx.count(id);
  const arg = (name: string) => compileNumberArg(ctx, b, name, 1);
  const bool = (name: string) => {
    const child = b.inputs[name];
    if (!child) throw new CompileProblem('Drop a yes/no block into the empty slot.', b.id);
    return compileValueBlock(ctx, child);
  };
  switch (b.type) {
    case 'sensor.distance':
      // blocks speak centimetres; the IR is SI
      return scale({ kind: 'sensorDistance', sensor: sensorOf(ctx, 'distance', b.id) }, 100);
    case 'sensor.line':
      return { kind: 'sensorLine', sensor: sensorOf(ctx, 'line', b.id) };
    case 'sensor.obstacle':
      return { kind: 'sensorObstacle' };
    case 'sensor.color':
      return {
        kind: 'compare',
        op: '==',
        left: { kind: 'sensorColor', sensor: sensorOf(ctx, 'color', b.id) },
        right: { kind: 'color', value: String(b.fields.color) as SensorColor },
      };
    case 'sensor.value': {
      const which = String(b.fields.sensor);
      if (which === 'distance') return scale({ kind: 'sensorDistance', sensor: sensorOf(ctx, 'distance', b.id) }, 100);
      if (which === 'line') return { kind: 'sensorLine', sensor: sensorOf(ctx, 'line', b.id) };
      if (which === 'touch') return { kind: 'sensorTouch', sensor: sensorOf(ctx, 'touch', b.id) };
      return { kind: 'sensorColor', sensor: sensorOf(ctx, 'color', b.id) };
    }
    case 'logic.compare': {
      const op = String(b.fields.op);
      const ops: Record<string, CompareOperator> = { '<': '<', '>': '>', '=': '==', '<=': '<=', '>=': '>=', '!=': '!=' };
      return { kind: 'compare', op: ops[op] ?? '==', left: arg('a'), right: arg('b') };
    }
    case 'sensor.robotX':
      return scale({ kind: 'robotX' }, 100);
    case 'sensor.robotY':
      return scale({ kind: 'robotY' }, 100);
    case 'mission.value': {
      const key = String(b.fields.key ?? '');
      if (!key) throw new CompileProblem('Choose a mission value.', b.id);
      return { kind: 'missionData', key };
    }
    case 'logic.and':
      return { kind: 'logic', op: 'and', left: bool('a'), right: bool('b') };
    case 'logic.or':
      return { kind: 'logic', op: 'or', left: bool('a'), right: bool('b') };
    case 'logic.not':
      return { kind: 'not', operand: bool('a') };
    case 'math.add':
      return { kind: 'arithmetic', op: '+', left: arg('a'), right: arg('b') };
    case 'math.subtract':
      return { kind: 'arithmetic', op: '-', left: arg('a'), right: arg('b') };
    case 'math.multiply':
      return { kind: 'arithmetic', op: '*', left: arg('a'), right: arg('b') };
    case 'math.divide':
      return { kind: 'arithmetic', op: '/', left: arg('a'), right: arg('b') };
    case 'math.random':
      return { kind: 'random', min: arg('from'), max: arg('to') };
    case 'variable.get':
      return { kind: 'variable', name: String(b.fields.name) };
    default:
      throw new CompileProblem(`“${getBlockDef(b.type).help}” can’t be used as a value.`, b.id);
  }
}

/**
 * A number argument: the plugged-in value block, or the typed literal.
 * `factor` converts student units to SI (cm → m = 0.01, ° → rad, % → 0–1).
 */
export function compileNumberArg(ctx: ExprContext, b: BlockInstance, name: string, factor: number): Expression {
  const child = b.inputs[name];
  if (child) return scale(compileValueBlock(ctx, child), factor);
  const v = b.fields[name];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new CompileProblem('Type a number here.', b.id);
  return num(v * factor);
}
