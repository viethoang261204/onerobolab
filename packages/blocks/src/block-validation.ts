import { getBlockDef } from './block-registry.ts';
import { START_ID } from './block-model.ts';
import type { BlockId, ProgramState } from './block-types.ts';
import { buildParentIndex, chainIds } from './block-utils.ts';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface BlockIssue {
  readonly severity: IssueSeverity;
  /** Student-facing explanation. */
  readonly message: string;
}

export interface ValidationResult {
  /** Most important issue per block (errors win over warnings over info). */
  readonly byBlock: Readonly<Record<BlockId, BlockIssue>>;
  readonly errors: number;
  readonly warnings: number;
}

const RANK: Record<IssueSeverity, number> = { error: 3, warning: 2, info: 1 };

/**
 * Checks what a student can fix. Nothing here blocks editing — the editor
 * only shows the result (red = must fix before running, amber = probably a
 * mistake, dim = won't run because it isn't connected).
 */
export function validateProgram(p: ProgramState): ValidationResult {
  const byBlock: Record<BlockId, BlockIssue> = {};
  const add = (id: BlockId, issue: BlockIssue) => {
    const current = byBlock[id];
    if (!current || RANK[issue.severity] > RANK[current.severity]) byBlock[id] = issue;
  };

  // Function names → their define block (the first one wins; duplicates are flagged).
  const defined = new Map<string, BlockId>();
  for (const root of p.roots) {
    const b = p.blocks[root.id];
    if (b?.type === 'function.define' && typeof b.fields.name === 'string' && !defined.has(b.fields.name)) defined.set(b.fields.name, b.id);
  }

  for (const block of Object.values(p.blocks)) {
    const def = getBlockDef(block.type);
    for (const [name, arg] of Object.entries(def.args)) {
      if (arg.kind === 'number') {
        if (block.inputs[name]) continue; // a value block supplies it
        const raw = block.fields[name];
        const value = typeof raw === 'number' ? raw : Number.NaN;
        if (!Number.isFinite(value)) {
          add(block.id, { severity: 'error', message: `Type a number for ${arg.label}.` });
          continue;
        }
        if ((arg.min !== undefined && value < arg.min) || (arg.max !== undefined && value > arg.max)) {
          const range = arg.min !== undefined && arg.max !== undefined ? `between ${arg.min} and ${arg.max}` : arg.min !== undefined ? `at least ${arg.min}` : `at most ${arg.max}`;
          add(block.id, { severity: 'warning', message: `The ${arg.label} should be ${range}${arg.unit ? ` ${arg.unit}` : ''}.` });
        }
        if (arg.integer && !Number.isInteger(value)) add(block.id, { severity: 'warning', message: `Use a whole number for ${arg.label}.` });
        if (block.type === 'math.divide' && name === 'b' && value === 0) add(block.id, { severity: 'warning', message: 'Dividing by zero has no answer.' });
      } else if (arg.kind === 'boolean') {
        if (!block.inputs[name]) add(block.id, { severity: 'error', message: 'Drop a yes/no block (like “line detected?”) into the empty slot.' });
      } else if (arg.kind === 'variable') {
        const v = block.fields[name];
        if (typeof v !== 'string' || !p.variables.includes(v)) add(block.id, { severity: 'error', message: 'Choose a variable.' });
      } else if (arg.kind === 'text') {
        const v = block.fields[name];
        if (typeof v !== 'string' || !FUNCTION_NAME.test(v)) add(block.id, { severity: 'error', message: 'Use letters, digits and _ for the name (start with a letter).' });
        else if (block.type === 'function.define' && defined.get(v) !== block.id) add(block.id, { severity: 'error', message: `There are two functions called “${v}”.` });
      } else if (arg.kind === 'functionName') {
        const v = block.fields[name];
        if (typeof v !== 'string' || !defined.has(v)) add(block.id, { severity: 'error', message: 'Choose a function you defined.' });
      } else if (arg.kind === 'dataKey') {
        const v = block.fields[name];
        if (typeof v !== 'string' || v === '') add(block.id, { severity: 'error', message: 'Choose a mission value.' });
      }
    }
    if (block.type === 'control.break' && !insideLoop(p, block.id)) add(block.id, { severity: 'error', message: '“break out of loop” only works inside a repeat block.' });
    if (block.type === 'control.forever' && block.next && !hasBreak(p, block.slots.body ?? null)) {
      for (const id of chainIds(p.blocks, block.next)) add(id, { severity: 'warning', message: 'This never runs: “repeat forever” only ends with a “break out of loop” inside it.' });
    }
    const firstSlot = def.slots?.[0];
    if (firstSlot && !block.slots[firstSlot.name]) add(block.id, { severity: 'warning', message: 'Put some blocks inside.' });
  }

  // Stacks not attached to the start block won't run.
  p.roots.forEach((root, i) => {
    if (i === 0 || root.id === START_ID) return;
    const head = p.blocks[root.id];
    if (!head) return;
    const def = getBlockDef(head.type);
    if (def.shape === 'hat') return; // other event scripts are valid entry points
    const message = def.output ? 'Value blocks must go inside another block.' : 'Not connected to “when program starts” — it won’t run.';
    for (const id of def.output ? [root.id] : chainIds(p.blocks, root.id)) add(id, { severity: 'info', message });
  });

  let errors = 0;
  let warnings = 0;
  for (const issue of Object.values(byBlock)) {
    if (issue.severity === 'error') errors++;
    else if (issue.severity === 'warning') warnings++;
  }
  return { byBlock, errors, warnings };
}

/**
 * Structural integrity (used when loading saved programs and in tests):
 * start block first, every reference resolves, every block attached exactly once.
 */
export function checkStructure(p: ProgramState): string[] {
  const problems: string[] = [];
  if (p.roots[0]?.id !== START_ID || p.blocks[START_ID]?.type !== 'event.start') problems.push('Start block missing or not first.');
  const refs = new Map<BlockId, number>();
  const count = (id: BlockId | null) => {
    if (!id) return;
    if (!p.blocks[id]) problems.push(`Missing block ${id}.`);
    refs.set(id, (refs.get(id) ?? 0) + 1);
  };
  p.roots.forEach((r) => count(r.id));
  for (const b of Object.values(p.blocks)) {
    count(b.next);
    Object.values(b.slots).forEach(count);
    Object.values(b.inputs).forEach(count);
  }
  for (const id of Object.keys(p.blocks)) {
    const n = refs.get(id) ?? 0;
    if (n !== 1) problems.push(`Block ${id} is attached ${n} times.`);
  }
  return problems;
}

/** Names a function may have (Python identifiers, short). */
export const FUNCTION_NAME = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;

const LOOPS = new Set(['control.repeat', 'control.forever', 'control.while', 'control.until']);

/** Is the block nested (at any depth) inside a loop's body? */
export function insideLoop(p: ProgramState, id: BlockId): boolean {
  const parents = buildParentIndex(p);
  for (let cur: BlockId | undefined = id; cur; ) {
    const ref = parents.get(cur);
    if (!ref || ref.kind === 'root') return false;
    if (ref.kind === 'slot' && LOOPS.has(p.blocks[ref.id]?.type ?? '')) return true;
    cur = ref.id;
  }
  return false;
}

/** Does a loop body contain a break that leaves *this* loop (not one in a nested loop)? */
function hasBreak(p: ProgramState, head: BlockId | null): boolean {
  for (const id of chainIds(p.blocks, head)) {
    const b = p.blocks[id];
    if (!b || b.disabled) continue;
    if (b.type === 'control.break') return true;
    if (LOOPS.has(b.type)) continue;
    for (const slot of Object.values(b.slots)) if (hasBreak(p, slot)) return true;
  }
  return false;
}
