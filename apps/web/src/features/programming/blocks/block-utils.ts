import { getBlockDef } from './block-registry';
import type { BlockFragment, BlockId, BlockInstance, BlockType, ParentRef, ProgramState } from './block-types';

let counter = 0;
/** Unique, readable block ids (`b-k3x9-12`). */
export function newBlockId(): BlockId {
  counter += 1;
  return `b-${Math.random().toString(36).slice(2, 6)}-${counter.toString(36)}`;
}

/** New block with the default values from its definition. */
export function createBlock(type: BlockType, variables: readonly string[] = [], id: BlockId = newBlockId()): BlockInstance {
  const def = getBlockDef(type);
  const fields: Record<string, string | number> = {};
  const inputs: Record<string, BlockId | null> = {};
  for (const [name, arg] of Object.entries(def.args)) {
    if (arg.kind === 'number') {
      fields[name] = arg.default;
      inputs[name] = null;
    } else if (arg.kind === 'dropdown' || arg.kind === 'text') fields[name] = arg.default;
    else if (arg.kind === 'variable') fields[name] = variables[0] ?? '';
    else if (arg.kind === 'dataKey' || arg.kind === 'functionName') fields[name] = '';
    else inputs[name] = null;
  }
  const slots: Record<string, BlockId | null> = {};
  for (const s of def.slots ?? []) slots[s.name] = null;
  return { id, type, fields, inputs, slots, next: null };
}

/** Map every block to how it is attached. O(n). */
export function buildParentIndex(p: ProgramState): Map<BlockId, ParentRef> {
  const index = new Map<BlockId, ParentRef>();
  p.roots.forEach((r, i) => index.set(r.id, { kind: 'root', index: i }));
  for (const b of Object.values(p.blocks)) {
    if (b.next) index.set(b.next, { kind: 'next', id: b.id });
    for (const [slot, child] of Object.entries(b.slots)) if (child) index.set(child, { kind: 'slot', id: b.id, slot });
    for (const [input, child] of Object.entries(b.inputs)) if (child) index.set(child, { kind: 'input', id: b.id, input });
  }
  return index;
}

/** Ids of a stack starting at `head`, following `next`. */
export function chainIds(blocks: ProgramState['blocks'], head: BlockId | null): BlockId[] {
  const out: BlockId[] = [];
  const seen = new Set<BlockId>();
  let id = head;
  while (id && blocks[id] && !seen.has(id)) {
    seen.add(id);
    out.push(id);
    id = blocks[id]?.next ?? null;
  }
  return out;
}

export function chainTail(blocks: ProgramState['blocks'], head: BlockId): BlockId {
  const chain = chainIds(blocks, head);
  return chain[chain.length - 1] ?? head;
}

/**
 * The block plus everything nested in it (slots and inputs, recursively).
 * With `includeNext`, blocks below it in the stack are included too.
 */
export function subtreeIds(blocks: ProgramState['blocks'], id: BlockId, includeNext: boolean): Set<BlockId> {
  const out = new Set<BlockId>();
  const visit = (bid: BlockId | null, followNext: boolean) => {
    let cur = bid;
    while (cur && blocks[cur] && !out.has(cur)) {
      const b = blocks[cur];
      if (!b) break;
      out.add(cur);
      for (const child of Object.values(b.slots)) visit(child, true);
      for (const child of Object.values(b.inputs)) visit(child, false);
      if (!followNext) break;
      cur = b.next;
    }
  };
  visit(id, includeNext);
  return out;
}

/** Detached copy of a block and its nested blocks (not the blocks below it). */
export function extractFragment(p: ProgramState, id: BlockId): BlockFragment {
  const ids = subtreeIds(p.blocks, id, false);
  const blocks: Record<BlockId, BlockInstance> = {};
  for (const bid of ids) {
    const b = p.blocks[bid];
    if (b) blocks[bid] = bid === id ? { ...b, next: null } : b;
  }
  return { rootId: id, blocks };
}

/** Same fragment with fresh ids everywhere (references rewritten). */
export function cloneFragment(fragment: BlockFragment): BlockFragment {
  const map = new Map<BlockId, BlockId>();
  for (const id of Object.keys(fragment.blocks)) map.set(id, newBlockId());
  const remap = (id: BlockId | null) => (id ? (map.get(id) ?? null) : null);
  const remapRecord = (rec: Readonly<Record<string, BlockId | null>>) =>
    Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, remap(v)]));
  const blocks: Record<BlockId, BlockInstance> = {};
  for (const b of Object.values(fragment.blocks)) {
    const id = map.get(b.id) ?? b.id;
    blocks[id] = { ...b, id, next: remap(b.next), inputs: remapRecord(b.inputs), slots: remapRecord(b.slots) };
  }
  return { rootId: map.get(fragment.rootId) ?? fragment.rootId, blocks };
}

export const fragmentFromBlock = (block: BlockInstance): BlockFragment => ({ rootId: block.id, blocks: { [block.id]: block } });

/** The root stack placement that ultimately contains `id`. */
export function rootOf(p: ProgramState, id: BlockId, index = buildParentIndex(p)): ProgramState['roots'][number] | null {
  let cur: BlockId = id;
  for (let guard = 0; guard < 10_000; guard++) {
    const ref = index.get(cur);
    if (!ref) return null;
    if (ref.kind === 'root') return p.roots[ref.index] ?? null;
    cur = ref.id;
  }
  return null;
}
