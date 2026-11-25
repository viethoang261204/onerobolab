import type { PointerEvent as ReactPointerEvent } from 'react';
import { checkDrop, START_ID } from '@robolab/blocks';
import { blockName, getBlockDef } from '@robolab/blocks';
import type { BlockFragment, BlockId, BlockInstance, BlockType, DropTarget, ProgramState } from '@robolab/blocks';
import { buildParentIndex, createBlock, fragmentFromBlock, subtreeIds } from '@robolab/blocks';
import { useDragStore, type DropHint } from '../state/drag-store';
import { useProgramStore } from '../state/program-store';
import { useUiStore } from '../../../stores/ui-store';
import { AudioManager } from '../../audio/audio-manager';
import { previewRegistry, workspaceRegistry } from './workspace-registry';

/** Snap configuration (screen pixels). */
export const SNAP = {
  /** Max vertical distance between the dragged block's top and a connection. */
  distance: 26,
  /** Horizontal tolerance left / right of a connection point. */
  left: 32,
  right: 96,
  /** Pixels the pointer must travel before a press becomes a drag. */
  threshold: 4,
} as const;

/** Visual scale of the preview relative to the workspace zoom. */
const PREVIEW_LIFT = 1.04;

export type DragSource =
  | { readonly kind: 'palette'; readonly type: BlockType; readonly scale: number }
  | { readonly kind: 'workspace'; readonly id: BlockId };

interface Candidate {
  readonly target: DropTarget;
  readonly kind: 'after' | 'slot' | 'input';
  readonly rect: DOMRect;
}

/** The dragged payload for an existing block: itself, nested blocks, and (for statements) the blocks below it. */
function movingFragment(p: ProgramState, id: BlockId): { fragment: BlockFragment; chain: Set<BlockId>; moving: Set<BlockId> } {
  const block = p.blocks[id];
  const isValue = block ? !!getBlockDef(block.type).output : false;
  const moving = subtreeIds(p.blocks, id, !isValue);
  const blocks: Record<BlockId, BlockInstance> = {};
  for (const bid of moving) {
    const b = p.blocks[bid];
    if (b) blocks[bid] = b;
  }
  const chain = new Set<BlockId>();
  for (let cur: BlockId | null = id; cur && moving.has(cur); cur = isValue ? null : (p.blocks[cur]?.next ?? null)) chain.add(cur);
  return { fragment: { rootId: id, blocks }, chain, moving };
}

/** Connection points currently on screen, filtered to the ones this payload may use. */
function collectCandidates(p: ProgramState, fragment: BlockFragment, moving: ReadonlySet<BlockId>): Candidate[] {
  const ws = workspaceRegistry.get();
  if (!ws) return [];
  const out: Candidate[] = [];
  for (const el of ws.content.querySelectorAll<HTMLElement>('[data-conn]')) {
    const blockId = el.dataset.blockId;
    const kind = el.dataset.conn;
    if (!blockId || moving.has(blockId)) continue;
    let target: DropTarget | null = null;
    if (kind === 'after') target = { kind: 'after', blockId };
    else if (kind === 'slot' && el.dataset.slot) target = { kind: 'slot', blockId, slot: el.dataset.slot };
    else if (kind === 'input' && el.dataset.input) target = { kind: 'input', blockId, input: el.dataset.input };
    if (!target || !checkDrop(p, fragment.blocks, fragment.rootId, target, moving).ok) continue;
    out.push({ target, kind: kind as Candidate['kind'], rect: el.getBoundingClientRect() });
  }
  return out;
}

function findTarget(candidates: readonly Candidate[], isValue: boolean, left: number, top: number, pointerX: number, pointerY: number): { target: DropTarget; hint: DropHint } | null {
  const zoom = workspaceRegistry.get()?.zoom() ?? 1;
  let best: { score: number; c: Candidate } | null = null;
  for (const c of candidates) {
    let score: number;
    if (isValue) {
      if (c.kind !== 'input') continue;
      const pad = 14;
      const inside = pointerX >= c.rect.left - pad && pointerX <= c.rect.right + pad && pointerY >= c.rect.top - pad && pointerY <= c.rect.bottom + pad;
      const leftHit = Math.abs(left - c.rect.left) < 40 && Math.abs(top - c.rect.top) < 20;
      if (!inside && !leftHit) continue;
      score = Math.hypot(pointerX - (c.rect.left + c.rect.width / 2), pointerY - (c.rect.top + c.rect.height / 2));
    } else {
      if (c.kind === 'input') continue;
      const px = c.rect.left;
      const py = c.kind === 'after' ? c.rect.bottom : c.rect.top;
      const dx = left - px;
      const dy = top - py;
      if (dx < -SNAP.left || dx > SNAP.right || Math.abs(dy) > SNAP.distance) continue;
      score = Math.abs(dy) + Math.abs(dx) * 0.25;
    }
    if (!best || score < best.score) best = { score, c };
  }
  if (!best) return null;
  const { c } = best;
  const hint: DropHint =
    c.kind === 'input'
      ? { kind: 'socket', x: c.rect.left, y: c.rect.top, width: c.rect.width, height: c.rect.height }
      : { kind: 'line', x: c.rect.left, y: c.kind === 'after' ? c.rect.bottom : c.rect.top, width: 150 * zoom };
  return { target: c.target, hint };
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Start a (potential) drag from a pointer-down on a palette or workspace
 * block. A press without movement is a click (selects the block). While
 * dragging: the preview follows the pointer, the best connection within
 * SNAP range is highlighted, and on release the store performs one
 * operation (one undo step). Escape cancels.
 */
export function startBlockDrag(e: ReactPointerEvent<HTMLElement>, source: DragSource): void {
  if (e.button !== 0) return;
  e.stopPropagation();
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;
  const program = useProgramStore.getState().program;
  const sourceScale = source.kind === 'palette' ? source.scale : (workspaceRegistry.get()?.zoom() ?? 1);
  const grab = { x: (startX - rect.left) / sourceScale, y: (startY - rect.top) / sourceScale };

  if (source.kind === 'workspace') useProgramStore.getState().select(source.id);
  if (source.kind === 'workspace' && source.id === START_ID) return; // entry point stays put

  let started = false;
  let candidates: Candidate[] = [];
  let isValue = false;
  let payload: { fragment: BlockFragment; chain: Set<BlockId>; moving: Set<BlockId> } | null = null;
  let last = { left: 0, top: 0 };

  const begin = () => {
    if (source.kind === 'palette') {
      useUiStore.getState().setCodeTab('blocks'); // drop target must be visible
      const block = createBlock(source.type, program.variables);
      payload = { fragment: fragmentFromBlock(block), chain: new Set(), moving: new Set() };
    } else {
      payload = movingFragment(program, source.id);
    }
    const head = payload.fragment.blocks[payload.fragment.rootId];
    if (!head) return false;
    const def = getBlockDef(head.type);
    isValue = !!def.output;
    candidates = def.shape === 'hat' ? [] : collectCandidates(program, payload.fragment, payload.moving);
    useDragStore.getState().set({
      session: { fragment: payload.fragment, shape: def.shape, sourceId: source.kind === 'workspace' ? source.id : null, chain: payload.chain },
      target: null,
      hint: null,
      overTrash: false,
    });
    document.body.classList.add('is-dragging-block');
    return true;
  };

  const place = (x: number, y: number) => {
    const zoom = workspaceRegistry.get()?.zoom() ?? 1;
    const s = zoom * PREVIEW_LIFT;
    last = { left: x - grab.x * s, top: y - grab.y * s };
    const preview = previewRegistry.get();
    if (preview) {
      preview.style.transform = `translate(${last.left}px, ${last.top}px) scale(${s})`;
      preview.dataset.placed = '1';
    }
  };

  const onMove = (ev: PointerEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < SNAP.threshold) return;
      started = begin();
      if (!started) return finish();
    }
    place(ev.clientX, ev.clientY);
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const overTrash = source.kind === 'workspace' && !!under?.closest('[data-drop-delete]');
    const found = overTrash ? null : findTarget(candidates, isValue, last.left, last.top, ev.clientX, ev.clientY);
    const drag = useDragStore.getState();
    if (drag.overTrash !== overTrash || !sameTarget(drag.target, found?.target ?? null)) {
      drag.set({ overTrash, target: found?.target ?? null, hint: found?.hint ?? null });
    }
  };

  const onUp = (ev: PointerEvent) => {
    if (!started || !payload) return finish();
    place(ev.clientX, ev.clientY);
    const { target, overTrash } = useDragStore.getState();
    const store = useProgramStore.getState();
    const ws = workspaceRegistry.get();
    const label = blockName(payload.fragment.blocks[payload.fragment.rootId]?.type ?? 'motion.stop');

    if (overTrash && source.kind === 'workspace') {
      store.deleteBlock(source.id);
      AudioManager.play('blockDrop');
    } else if (target) {
      const ok = source.kind === 'palette' ? store.addFragment(payload.fragment, target, `Block added: ${label}.`) !== null : store.moveBlock(source.id, target);
      if (ok) AudioManager.play('blockConnect');
    } else if (ws && pointInside(ws.viewport, ev.clientX, ev.clientY)) {
      AudioManager.play('blockDrop');
      const at = ws.toContent(last.left, last.top);
      if (source.kind === 'palette') store.addFragment(payload.fragment, { kind: 'workspace', ...at }, `Block added: ${label}.`);
      else if (buildParentIndex(store.program).get(source.id)?.kind === 'root') store.moveRoot(source.id, at.x, at.y);
      else store.moveBlock(source.id, { kind: 'workspace', ...at });
    }
    // else: dropped outside the editor → nothing changes (block returns).
    finish();
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') finish();
  };

  function finish() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', finish);
    window.removeEventListener('keydown', onKey, true);
    document.body.classList.remove('is-dragging-block');
    if (started) useDragStore.getState().set({ session: null, target: null, hint: null, overTrash: false });
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', finish);
  window.addEventListener('keydown', onKey, true);
}

const pointInside = (el: HTMLElement, x: number, y: number) => {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};
