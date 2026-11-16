import { getBlockDef } from './block-registry';
import type { BlockFragment, BlockId, BlockInstance, DropTarget, FieldValue, ProgramState } from './block-types';
import { buildParentIndex, chainTail, cloneFragment, extractFragment, rootOf, subtreeIds } from './block-utils';

/*
 * Pure, immutable program operations. Every function returns a new
 * ProgramState (or the same object when nothing changed) and never mutates
 * its input — which makes undo/redo a matter of keeping old references.
 */

export const START_ID = 'start';

type Blocks = Record<BlockId, BlockInstance>;

const withBlocks = (p: ProgramState, blocks: Blocks, roots: ProgramState['roots'] = p.roots): ProgramState => ({ ...p, blocks, roots });

const replace = (blocks: Blocks, id: BlockId, patch: Partial<BlockInstance>) => {
  const b = blocks[id];
  if (b) blocks[id] = { ...b, ...patch };
};

export class InvalidOperation extends Error {}

/** Why a drop is (in)valid — students see `reason` as a hint. */
export interface DropCheck {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * Can the stack headed by `headId` (found in `blocks`) connect at `target`?
 * `moving` holds ids that are being moved (the target may not be inside them).
 */
export function checkDrop(p: ProgramState, blocks: ProgramState['blocks'], headId: BlockId, target: DropTarget, moving: ReadonlySet<BlockId> = new Set()): DropCheck {
  const head = blocks[headId];
  if (!head) return { ok: false, reason: 'Unknown block.' };
  const def = getBlockDef(head.type);
  if (target.kind === 'workspace') return { ok: true };
  if (moving.has(target.blockId)) return { ok: false, reason: 'A block can’t go inside itself.' };
  const host = p.blocks[target.blockId];
  if (!host) return { ok: false, reason: 'Unknown target.' };
  const hostDef = getBlockDef(host.type);

  if (target.kind === 'input') {
    const arg = hostDef.args[target.input];
    if (!arg || !def.output) return { ok: false, reason: 'Only value blocks fit here.' };
    if (arg.kind === 'boolean' && def.output === 'boolean') return { ok: true };
    if (arg.kind === 'number' && def.output === 'number') return { ok: true };
    return { ok: false, reason: arg.kind === 'boolean' ? 'This socket needs a yes/no block.' : 'This socket needs a number block.' };
  }

  if (def.shape !== 'statement' && def.shape !== 'c') return { ok: false, reason: 'Only action blocks can be stacked.' };
  const displaced = target.kind === 'after' ? host.next : (host.slots[target.slot] ?? null);
  if (target.kind === 'after' && !hostDef.hasNext) return { ok: false, reason: 'Nothing can go below this block.' };
  if (target.kind === 'slot' && !(target.slot in host.slots)) return { ok: false, reason: 'Unknown slot.' };
  if (displaced) {
    const tail = blocks[chainTail(blocks, headId)];
    if (tail && !getBlockDef(tail.type).hasNext) return { ok: false, reason: 'Blocks can’t go below “break out of loop”.' };
  }
  return { ok: true };
}

/** Unlink the stack starting at `id` from wherever it is attached (it stays in `blocks`). */
function detach(p: ProgramState, id: BlockId): ProgramState {
  const ref = buildParentIndex(p).get(id);
  if (!ref) return p;
  const blocks: Blocks = { ...p.blocks };
  let roots = p.roots;
  if (ref.kind === 'root') roots = p.roots.filter((_, i) => i !== ref.index);
  else if (ref.kind === 'next') replace(blocks, ref.id, { next: null });
  else if (ref.kind === 'slot') {
    const host = blocks[ref.id];
    if (host) replace(blocks, ref.id, { slots: { ...host.slots, [ref.slot]: null } });
  } else {
    const host = blocks[ref.id];
    if (host) replace(blocks, ref.id, { inputs: { ...host.inputs, [ref.input]: null } });
  }
  return withBlocks(p, blocks, roots);
}

/** Connect an already-present, unattached stack at `target`. */
function attach(p: ProgramState, headId: BlockId, target: DropTarget): ProgramState {
  const blocks: Blocks = { ...p.blocks };
  let roots = p.roots;
  const tail = chainTail(blocks, headId);
  switch (target.kind) {
    case 'workspace':
      roots = [...p.roots, { id: headId, x: Math.round(target.x), y: Math.round(target.y) }];
      break;
    case 'after': {
      const host = blocks[target.blockId];
      if (!host) break;
      if (host.next) replace(blocks, tail, { next: host.next });
      replace(blocks, target.blockId, { next: headId });
      break;
    }
    case 'slot': {
      const host = blocks[target.blockId];
      if (!host) break;
      const existing = host.slots[target.slot] ?? null;
      if (existing) replace(blocks, tail, { next: existing });
      replace(blocks, target.blockId, { slots: { ...host.slots, [target.slot]: headId } });
      break;
    }
    case 'input': {
      const host = blocks[target.blockId];
      if (!host) break;
      const occupant = host.inputs[target.input] ?? null;
      replace(blocks, target.blockId, { inputs: { ...host.inputs, [target.input]: headId } });
      if (occupant) {
        // Kick the previous value block out next to the host's stack.
        const root = rootOf(p, target.blockId);
        roots = [...roots, { id: occupant, x: (root?.x ?? 0) + 40, y: (root?.y ?? 0) - 40 }];
      }
      break;
    }
  }
  return withBlocks(p, blocks, roots);
}

/** Add a new block tree (from the toolbox or clipboard) at `target`. */
export function insertFragment(p: ProgramState, fragment: BlockFragment, target: DropTarget): ProgramState {
  const check = checkDrop(p, fragment.blocks, fragment.rootId, target);
  if (!check.ok) throw new InvalidOperation(check.reason);
  if (fragment.blocks[START_ID] || fragment.rootId in p.blocks) throw new InvalidOperation('Fragment ids must be fresh.');
  const merged = withBlocks(p, { ...p.blocks, ...fragment.blocks });
  return attach(merged, fragment.rootId, target);
}

/**
 * Move a block to `target`. Statement blocks bring the blocks below them
 * (like picking up the bottom of a stack); value blocks move alone.
 */
export function moveBlock(p: ProgramState, id: BlockId, target: DropTarget): ProgramState {
  if (id === START_ID) throw new InvalidOperation('The start block stays at the top.');
  const block = p.blocks[id];
  if (!block) throw new InvalidOperation('Unknown block.');
  const isValue = !!getBlockDef(block.type).output;
  const moving = subtreeIds(p.blocks, id, !isValue);
  const check = checkDrop(p, p.blocks, id, target, moving);
  if (!check.ok) throw new InvalidOperation(check.reason);
  return attach(detach(p, id), id, target);
}

/** Split a stack: `id` and the blocks below it become a separate stack at (x, y). */
export const disconnectBlock = (p: ProgramState, id: BlockId, x: number, y: number): ProgramState => moveBlock(p, id, { kind: 'workspace', x, y });

/**
 * Delete one block together with everything nested inside it. Blocks below
 * it close the gap. The start block cannot be deleted.
 */
export function deleteBlock(p: ProgramState, id: BlockId): ProgramState {
  if (id === START_ID) throw new InvalidOperation('The start block can’t be deleted.');
  const block = p.blocks[id];
  if (!block) return p;
  const ref = buildParentIndex(p).get(id);
  const removed = subtreeIds(p.blocks, id, false);
  const blocks: Blocks = { ...p.blocks };
  let roots = p.roots;
  const next = block.next;
  if (ref?.kind === 'root') {
    roots = next ? p.roots.map((r, i) => (i === ref.index ? { ...r, id: next } : r)) : p.roots.filter((_, i) => i !== ref.index);
  } else if (ref?.kind === 'next') replace(blocks, ref.id, { next });
  else if (ref?.kind === 'slot') {
    const host = blocks[ref.id];
    if (host) replace(blocks, ref.id, { slots: { ...host.slots, [ref.slot]: next } });
  } else if (ref?.kind === 'input') {
    const host = blocks[ref.id];
    if (host) replace(blocks, ref.id, { inputs: { ...host.inputs, [ref.input]: null } });
  }
  for (const rid of removed) delete blocks[rid];
  return withBlocks(p, blocks, roots);
}

/**
 * Independent copy (new ids, nested children included) placed right below the
 * original — or next to its stack when nothing can follow it.
 */
export function duplicateBlock(p: ProgramState, id: BlockId): { program: ProgramState; newId: BlockId } {
  if (id === START_ID) throw new InvalidOperation('There can only be one start block.');
  const block = p.blocks[id];
  if (!block) throw new InvalidOperation('Unknown block.');
  const copy = cloneFragment(extractFragment(p, id));
  const def = getBlockDef(block.type);
  const stackable = (def.shape === 'statement' || def.shape === 'c') && def.hasNext && buildParentIndex(p).get(id) !== undefined;
  if (stackable) return { program: insertFragment(p, copy, { kind: 'after', blockId: id }), newId: copy.rootId };
  const root = rootOf(p, id);
  return { program: insertFragment(p, copy, { kind: 'workspace', x: (root?.x ?? 0) + 30, y: (root?.y ?? 0) + 30 }), newId: copy.rootId };
}

export function updateField(p: ProgramState, id: BlockId, name: string, value: FieldValue): ProgramState {
  const block = p.blocks[id];
  if (!block || !(name in block.fields) || block.fields[name] === value) return p;
  return withBlocks(p, { ...p.blocks, [id]: { ...block, fields: { ...block.fields, [name]: value } } });
}

export function setComment(p: ProgramState, id: BlockId, comment: string | null): ProgramState {
  const block = p.blocks[id];
  if (!block) return p;
  const { comment: _old, ...rest } = block;
  const next: BlockInstance = comment === null ? rest : { ...rest, comment };
  return withBlocks(p, { ...p.blocks, [id]: next });
}

export function setDisabled(p: ProgramState, id: BlockId, disabled: boolean): ProgramState {
  if (id === START_ID) return p;
  const block = p.blocks[id];
  if (!block) return p;
  const { disabled: _old, ...rest } = block;
  return withBlocks(p, { ...p.blocks, [id]: disabled ? { ...rest, disabled: true } : rest });
}

export function addVariable(p: ProgramState, name: string): ProgramState {
  const clean = name.trim();
  if (!clean || p.variables.includes(clean)) return p;
  return { ...p, variables: [...p.variables, clean] };
}

/** Move a whole stack on the workspace (dragging its top block to empty space). */
export function moveRoot(p: ProgramState, id: BlockId, x: number, y: number): ProgramState {
  const index = p.roots.findIndex((r) => r.id === id);
  if (index < 0) return p;
  const roots = p.roots.filter((_, i) => i !== index);
  // Moved stacks come to the front (drawn last).
  return { ...p, roots: [...roots, { id, x: Math.round(x), y: Math.round(y) }] };
}
