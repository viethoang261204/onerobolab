import { OBSTACLE_DISTANCE, type Expression, type Pose2D, type RuntimeValue, type SensorSnapshot } from '@robolab/shared';

/** A problem the student can fix (shown in plain language, never as a stack trace). */
export class ProgramProblem extends Error {
  constructor(
    message: string,
    readonly blockId: string | null = null,
  ) {
    super(message);
    this.name = 'ProgramProblem';
  }
}

export interface EvalContext {
  readonly variables: Readonly<Record<string, RuntimeValue>>;
  readonly sensors: SensorSnapshot;
  /** Seeded generator in [0, 1). */
  readonly random: () => number;
  /** Robot pose at the start of the tick (position reporters). */
  readonly pose?: Pose2D;
  /** Mission data for this run. */
  readonly data?: Readonly<Record<string, number>>;
}

const toNumber = (v: RuntimeValue): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new ProgramProblem(`A colour (“${v}”) can’t be used as a number.`);
};

const toBool = (v: RuntimeValue): boolean => (typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : v !== 'none');

/**
 * Evaluates a typed expression tree. No `eval`, no strings of code — only the
 * known node kinds, so execution is safe and deterministic.
 */
export function evaluate(expr: Expression, ctx: EvalContext): RuntimeValue {
  switch (expr.kind) {
    case 'number':
    case 'boolean':
    case 'color':
      return expr.value;
    case 'variable': {
      const v = ctx.variables[expr.name];
      if (v === undefined) throw new ProgramProblem(`The variable “${expr.name}” doesn’t exist.`);
      return v;
    }
    case 'arithmetic': {
      const a = toNumber(evaluate(expr.left, ctx));
      const b = toNumber(evaluate(expr.right, ctx));
      switch (expr.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          if (b === 0) throw new ProgramProblem('Dividing by zero has no answer. Check the divide block.');
          return a / b;
      }
      break;
    }
    case 'compare': {
      const l = evaluate(expr.left, ctx);
      const r = evaluate(expr.right, ctx);
      if (expr.op === '==') return l === r || (typeof l !== 'string' && typeof r !== 'string' && toNumber(l) === toNumber(r));
      if (expr.op === '!=') return !(l === r);
      const a = toNumber(l);
      const b = toNumber(r);
      return expr.op === '<' ? a < b : expr.op === '<=' ? a <= b : expr.op === '>' ? a > b : a >= b;
    }
    case 'logic': {
      const a = toBool(evaluate(expr.left, ctx));
      return expr.op === 'and' ? a && toBool(evaluate(expr.right, ctx)) : a || toBool(evaluate(expr.right, ctx));
    }
    case 'not':
      return !toBool(evaluate(expr.operand, ctx));
    case 'sensorDistance': {
      const r = ctx.sensors[expr.sensor];
      return r?.kind === 'distance' && r.distance !== null ? r.distance : Infinity;
    }
    case 'sensorLine': {
      const r = ctx.sensors[expr.sensor];
      return r?.kind === 'line' ? r.onLine : false;
    }
    case 'sensorColor': {
      const r = ctx.sensors[expr.sensor];
      return r?.kind === 'color' ? r.color : 'none';
    }
    case 'sensorTouch': {
      const r = ctx.sensors[expr.sensor];
      return r?.kind === 'touch' ? r.pressed : false;
    }
    case 'sensorObstacle':
      return Object.values(ctx.sensors).some(
        (r) => (r?.kind === 'distance' && r.distance !== null && r.distance < OBSTACLE_DISTANCE) || (r?.kind === 'touch' && r.pressed),
      );
    case 'missionData': {
      const v = ctx.data?.[expr.key];
      if (v === undefined) throw new ProgramProblem(`This mission has no value called “${expr.key}”.`);
      return v;
    }
    case 'robotX':
      return ctx.pose?.x ?? 0;
    case 'robotY':
      return -(ctx.pose?.z ?? 0);
    case 'random': {
      const a = Math.ceil(toNumber(evaluate(expr.min, ctx)));
      const b = Math.floor(toNumber(evaluate(expr.max, ctx)));
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      return lo + Math.floor(ctx.random() * (hi - lo + 1));
    }
  }
  throw new ProgramProblem('Unknown block value.');
}

export const evaluateNumber = (e: Expression, ctx: EvalContext): number => toNumber(evaluate(e, ctx));
export const evaluateBool = (e: Expression, ctx: EvalContext): boolean => toBool(evaluate(e, ctx));
