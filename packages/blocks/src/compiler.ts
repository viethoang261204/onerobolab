import { degToRad, type CompileDiagnostic, type CompileResult, type ProgramCompiler, type RobotDefinition, type Statement } from '@robolab/shared';
import { START_ID } from './block-model.ts';
import { getBlockDef } from './block-registry.ts';
import type { BlockId, BlockInstance, ProgramState } from './block-types.ts';
import { chainIds } from './block-utils.ts';
import { checkStructure, validateProgram } from './block-validation.ts';
import { CompileProblem, compileError, compileWarning } from './compiler-errors.ts';
import { compileNumberArg, compileValueBlock, type ExprContext } from './expression-compiler.ts';

/** Student units → SI factors used by the IR. */
const CM = 0.01;
const DEG = degToRad(1);
const PERCENT = 0.01;

/**
 * Block program → RoboLab IR (the command list the runtime executes).
 *
 *   ProgramState ──validate──▶ diagnostics ──compile──▶ Program (IR) ──▶ CommandQueue
 *
 * Only the "when program starts" script is compiled; disabled blocks are
 * skipped; every command keeps `source.blockId` for execution highlighting.
 * Pure and deterministic — it never touches the robot or the UI.
 */
export function compileProgram(program: ProgramState, robot: RobotDefinition): CompileResult {
  const diagnostics: CompileDiagnostic[] = [];

  for (const problem of checkStructure(program)) diagnostics.push(compileError(`The program is damaged: ${problem}`, null));
  const validation = validateProgram(program);
  for (const [id, issue] of Object.entries(validation.byBlock)) {
    if (issue.severity === 'error') diagnostics.push(compileError(issue.message, id));
  }
  if (diagnostics.some((d) => d.severity === 'error')) return { ok: false, diagnostics };

  const counted = new Set<BlockId>();
  const ctx: ExprContext = { program, robot, count: (id) => counted.add(id) };

  // Functions ("define …" scripts) are inlined where they are run; a function may not run itself.
  const functions = new Map<string, BlockInstance>();
  for (const root of program.roots) {
    const b = program.blocks[root.id];
    if (b?.type === 'function.define' && !b.disabled) functions.set(String(b.fields.name), b);
  }
  const calling: string[] = [];

  const stack = (head: BlockId | null): Statement[] => {
    const out: Statement[] = [];
    for (const id of chainIds(program.blocks, head)) {
      const b = program.blocks[id];
      if (!b || b.disabled) continue;
      out.push(...statement(b));
    }
    return out;
  };

  const statement = (b: BlockInstance): Statement[] => {
    ctx.count(b.id);
    const source = { blockId: b.id };
    const n = (name: string, factor: number) => compileNumberArg(ctx, b, name, factor);
    const cond = () => {
      const child = b.inputs.condition;
      if (!child) throw new CompileProblem('Drop a yes/no block into the empty slot.', b.id);
      return compileValueBlock(ctx, child);
    };
    switch (b.type) {
      case 'motion.step':
        return [{ op: 'move', direction: 'forward', distance: n('steps', 0.6), source }];
      case 'motion.forward':
        return [{ op: 'move', direction: 'forward', distance: n('distance', CM), source }];
      case 'motion.backward':
        return [{ op: 'move', direction: 'backward', distance: n('distance', CM), source }];
      case 'motion.turnLeft':
        return [{ op: 'turn', direction: 'left', angle: n('angle', DEG), source }];
      case 'motion.turnRight':
        return [{ op: 'turn', direction: 'right', angle: n('angle', DEG), source }];
      case 'motion.stop':
        return [{ op: 'stop', source }];
      case 'motion.speed':
        return [{ op: 'setSpeed', speed: n('speed', PERCENT), source }];
      case 'control.wait':
        return [{ op: 'wait', seconds: n('seconds', 1), source }];
      case 'control.repeat':
        return [{ op: 'repeat', times: n('count', 1), body: stack(b.slots.body ?? null), source }];
      case 'control.forever':
        return [{ op: 'while', condition: { kind: 'boolean', value: true }, body: stack(b.slots.body ?? null), source }];
      case 'control.while':
        return [{ op: 'while', condition: cond(), body: stack(b.slots.body ?? null), source }];
      case 'control.until':
        return [{ op: 'while', condition: { kind: 'not', operand: cond() }, body: stack(b.slots.body ?? null), source }];
      case 'control.break':
        return [{ op: 'break', source }];
      case 'motion.goTo':
        return [{ op: 'goTo', x: n('x', CM), y: n('y', CM), source }];
      case 'action.pick':
        return [{ op: 'pick', source }];
      case 'action.drop':
        return [{ op: 'drop', source }];
      case 'function.call': {
        const name = String(b.fields.name);
        const def = functions.get(name);
        if (!def) throw new CompileProblem(`There is no function called “${name}”. Add a “define ${name}” block.`, b.id);
        if (calling.includes(name)) throw new CompileProblem(`The function “${name}” runs itself — that would never end. Remove the “run ${name}” block inside it.`, b.id);
        ctx.count(def.id);
        calling.push(name);
        try {
          return stack(def.next);
        } finally {
          calling.pop();
        }
      }
      case 'control.if':
        return [{ op: 'if', condition: cond(), then: stack(b.slots.then ?? null), source }];
      case 'control.ifElse':
        return [{ op: 'if', condition: cond(), then: stack(b.slots.then ?? null), else: stack(b.slots.else ?? null), source }];
      case 'variable.set':
        return [{ op: 'setVar', name: String(b.fields.name), value: n('value', 1), source }];
      case 'variable.change':
        return [{ op: 'changeVar', name: String(b.fields.name), delta: n('delta', 1), source }];
      default:
        throw new CompileProblem(`“${getBlockDef(b.type).help}” can’t be used as a step in the program.`, b.id);
    }
  };

  try {
    const body = stack(program.blocks[START_ID]?.next ?? null);
    for (const root of program.roots.slice(1)) {
      const head = program.blocks[root.id];
      if (head && head.type !== 'function.define' && getBlockDef(head.type).shape === 'hat') diagnostics.push(compileWarning('Only “when program starts” scripts run for now — this script is ignored.', root.id));
    }
    return { ok: true, program: { irVersion: 1, variables: [...program.variables], body }, blockCount: counted.size, diagnostics };
  } catch (e) {
    if (!(e instanceof CompileProblem)) throw e;
    return { ok: false, diagnostics: [...diagnostics, compileError(e.message, e.blockId)] };
  }
}

/** The block editor's implementation of the shared `ProgramCompiler` contract. */
export const blockCompiler = (robot: RobotDefinition): ProgramCompiler<ProgramState> => ({
  compile: (program) => compileProgram(program, robot),
});
