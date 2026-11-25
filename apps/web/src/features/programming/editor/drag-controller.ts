import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  START_ID,
  buildParentIndex,
  chainTail,
  checkDrop,
  createBlock,
  fragmentFromBlock,
  getBlockDef,
  subtreeIds,
  type BlockFragment,
  type BlockId,
  type BlockInstance,
  type BlockType,
  type DropTarget,
  type ProgramState,
} from '@robolab/blocks';
import { useUiStore } from '../../../stores/ui-store';
import { AudioManager } from '../../audio/audio-manager';
import { messagesFor } from '../../i18n/i18n';
import { localizedBlockName } from '../blocks-vi';
import { programmingMessages } from '../programming.messages';
import { useDragStore, type DropHint } from '../state/drag-store';
import { useProgramStore } from '../state/program-store';
import { previewRegistry, workspaceRegistry } from './workspace-registry';

/** Snap configuration (screen pixels). */
export const SNAP = {
  /** Max vertical distance between the dragged block's top and a connection. */
  distance: 26,
  /** Horizontal tolerance left / right of a connection point. */
  left: 32,
  right: 96,
  /** Pixels a mouse pointer must travel before a press becomes a drag. */
  threshold: 4,
  /** Pixels a touch/pen pointer must travel before a press becomes a drag. */
  touchThreshold: 8,
  /** Hold duration (ms) for touch/pen long-press to open the block context menu. */
  longPressMs: 450,
} as const;

/** Visual scale of the preview relative to the workspace zoom. */
const PREVIEW_LIFT = 1.04;

export type DragSource =
  | { readonly kind: 'palette'; readonly type: BlockType; readonly scale: number }
  | { readonly kind: 'workspace'; readonly id: BlockId };

export interface DragOptions {
  /** Called after a clean tap on a palette block adds it to the program. */
  readonly onTapAdded?: () => void;
}

interface Candidate {
  readonly target: DropTarget;
  readonly kind: 'after' | 'slot' | 'input';
  readonly rect: DOMRect;
}

let cancelCurrent: (() => void) | null = null;
let tapStagger = 0;

/** Cancel any active pointer drag (e.g. when a second finger starts pinch-zoom). */
export function cancelActiveDrag(): void {
  cancelCurrent?.();
}

/**
 * Tap-to-add a block from the toolbox (alternative to dragging on touch/tablet
 * and keyboard). Connects after the selected block or at the end of the main
 * stack, into a matching empty input socket, or onto free workspace space.
 */
export function addBlockFromPalette(type: BlockType): BlockId | null {
  if (type === 'event.start') return null;
  useUiStore.getState().setCodeTab('blocks');
  const store = useProgramStore.getState();
  const { program, selectedId } = store;
  const block = createBlock(type, program.variables);
  const fragment = fragmentFromBlock(block);
  const def = getBlockDef(type);
  const startRoot = program.roots[0] ?? { id: START_ID, x: 40, y: 40 };

  let target: DropTarget | null = null;

  if (def.shape === 'statement' || def.shape === 'c') {
    if (selectedId && checkDrop(program, fragment.blocks, fragment.rootId, { kind: 'after', blockId: selectedId }).ok) {
      target = { kind: 'after', blockId: selectedId };
    } else {
      const tail = chainTail(program.blocks, START_ID);
      if (checkDrop(program, fragment.blocks, fragment.rootId, { kind: 'after', blockId: tail }).ok) {
        target = { kind: 'after', blockId: tail };
      }
    }
  } else if (def.output) {
    // If a block with a matching empty input socket is selected, snap directly into it.
    const host = selectedId ? program.blocks[selectedId] : undefined;
    if (host) {
      const hostDef = getBlockDef(host.type);
      for (const [argName, argDef] of Object.entries(hostDef.args)) {
        if (host.inputs[argName]) continue;
        const matches = (argDef.kind === 'boolean' && def.output === 'boolean') || (argDef.kind === 'number' && def.output === 'number');
        if (matches && checkDrop(program, fragment.blocks, fragment.rootId, { kind: 'input', blockId: host.id, input: argName }).ok) {
          target = { kind: 'input', blockId: host.id, input: argName };
          break;
        }
      }
    }
  }

  if (!target) {
    const offset = (tapStagger++ % 6) * 28;
    const maxX = program.roots.reduce((m, r) => Math.max(m, r.x), startRoot.x);
    const x = def.shape === 'hat' ? maxX + 320 : startRoot.x + 260 + offset;
    const y = startRoot.y + 40 + offset;
    target = { kind: 'workspace', x, y };
  }

  const label = localizedBlockName(type);
  const addedId = store.addFragment(fragment, target, messagesFor(programmingMessages).logBlockAdded({ label }));
  if (addedId) {
    AudioManager.play(target.kind === 'workspace' ? 'blockDrop' : 'blockConnect');
    if (target.kind === 'workspace') workspaceRegistry.get()?.reveal(target.x, target.y);
  }
  return addedId;
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

function findTarget(
  candidates: readonly Candidate[],
  isValue: boolean,
  left: number,
  top: number,
  pointerX: number,
  pointerY: number,
  scale: number,
): { target: DropTarget; hint: DropHint } | null {
  const zoom = workspaceRegistry.get()?.zoom() ?? 1;
  let best: { score: number; c: Candidate } | null = null;
  for (const c of candidates) {
    let score: number;
    if (isValue) {
      if (c.kind !== 'input') continue;
      const pad = 14 * scale;
      const inside = pointerX >= c.rect.left - pad && pointerX <= c.rect.right + pad && pointerY >= c.rect.top - pad && pointerY <= c.rect.bottom + pad;
      const leftHit = Math.abs(left - c.rect.left) < 40 * scale && Math.abs(top - c.rect.top) < 20 * scale;
      if (!inside && !leftHit) continue;
      score = Math.hypot(pointerX - (c.rect.left + c.rect.width / 2), pointerY - (c.rect.top + c.rect.height / 2));
    } else {
      if (c.kind === 'input') continue;
      const px = c.rect.left;
      const py = c.kind === 'after' ? c.rect.bottom : c.rect.top;
      const dx = left - px;
      const dy = top - py;
      if (dx < -SNAP.left * scale || dx > SNAP.right * scale || Math.abs(dy) > SNAP.distance * scale) continue;
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
 * block. Works identically with mouse, touch and pen via Pointer Events:
 *   - Clean tap on a workspace block → selects it (opens action bar).
 *   - Long-press on a workspace block (touch/pen) → opens action bar without dragging.
 *   - Clean tap on a palette block → adds it directly to the program (tap-to-add).
 *   - Dragging beyond threshold → live preview + magnetic snap + one undo step.
 *   - Escape or second touch finger cancels cleanly.
 */
export function startBlockDrag(e: ReactPointerEvent<HTMLElement>, source: DragSource, opts?: DragOptions): void {
  if (e.button !== 0 || !e.isPrimary) return;
  e.stopPropagation();

  const pointerId = e.pointerId;
  const isTouchLike = e.pointerType === 'touch' || e.pointerType === 'pen';
  const threshold = isTouchLike ? SNAP.touchThreshold : SNAP.threshold;
  const snapScale = isTouchLike ? 1.35 : 1;

  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;
  const program = useProgramStore.getState().program;
  const sourceScale = source.kind === 'palette' ? source.scale : (workspaceRegistry.get()?.zoom() ?? 1);
  const grab = { x: (startX - rect.left) / sourceScale, y: (startY - rect.top) / sourceScale };

  if (source.kind === 'workspace') useProgramStore.getState().select(source.id);
  if (source.kind === 'workspace' && source.id === START_ID) return; // entry point stays put

  // Cancel any stale drag before starting a new one.
  cancelCurrent?.();

  let started = false;
  let cancelled = false;
  let candidates: Candidate[] = [];
  let isValue = false;
  let payload: { fragment: BlockFragment; chain: Set<BlockId>; moving: Set<BlockId> } | null = null;
  let last = { left: 0, top: 0 };
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;

  if (source.kind === 'workspace' && isTouchLike) {
    longPressTimer = setTimeout(() => {
      if (started || cancelled) return;
      useProgramStore.getState().select(source.id);
      try {
        navigator.vibrate?.(15);
      } catch {
        // ignore unsupported vibration
      }
      finish();
    }, SNAP.longPressMs);
  }

  const begin = () => {
    clearTimeout(longPressTimer);
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
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // ignore synthetic events or detached targets
    }
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
    if (ev.pointerId !== pointerId || cancelled) return;
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return;
      started = begin();
      if (!started) return finish();
    }
    place(ev.clientX, ev.clientY);
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const overTrash = source.kind === 'workspace' && !!under?.closest('[data-drop-delete]');
    const found = overTrash ? null : findTarget(candidates, isValue, last.left, last.top, ev.clientX, ev.clientY, snapScale);
    const drag = useDragStore.getState();
    if (drag.overTrash !== overTrash || !sameTarget(drag.target, found?.target ?? null)) {
      drag.set({ overTrash, target: found?.target ?? null, hint: found?.hint ?? null });
    }
  };

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId || cancelled) return;
    if (!started || !payload) {
      // Clean tap without drag on a palette block → tap-to-add!
      if (source.kind === 'palette') {
        const added = addBlockFromPalette(source.type);
        if (added) opts?.onTapAdded?.();
      }
      return finish();
    }
    place(ev.clientX, ev.clientY);
    const { target, overTrash } = useDragStore.getState();
    const store = useProgramStore.getState();
    const ws = workspaceRegistry.get();
    const label = localizedBlockName(payload.fragment.blocks[payload.fragment.rootId]?.type ?? 'motion.stop');
    const addedMsg = messagesFor(programmingMessages).logBlockAdded({ label });

    if (overTrash && source.kind === 'workspace') {
      store.deleteBlock(source.id);
      AudioManager.play('blockDrop');
    } else if (target) {
      const ok = source.kind === 'palette' ? store.addFragment(payload.fragment, target, addedMsg) !== null : store.moveBlock(source.id, target);
      if (ok) AudioManager.play('blockConnect');
    } else if (ws && pointInside(ws.viewport, ev.clientX, ev.clientY)) {
      AudioManager.play('blockDrop');
      const at = ws.toContent(last.left, last.top);
      if (source.kind === 'palette') store.addFragment(payload.fragment, { kind: 'workspace', ...at }, addedMsg);
      else if (buildParentIndex(store.program).get(source.id)?.kind === 'root') store.moveRoot(source.id, at.x, at.y);
      else store.moveBlock(source.id, { kind: 'workspace', ...at });
    }
    // else: dropped outside the editor → nothing changes (block returns).
    finish();
  };

  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    finish();
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') finish();
  };

  function finish() {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(longPressTimer);
    if (cancelCurrent === finish) cancelCurrent = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    document.body.classList.remove('is-dragging-block');
    try {
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }
    if (started) useDragStore.getState().set({ session: null, target: null, hint: null, overTrash: false });
  }

  cancelCurrent = finish;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);
}

const pointInside = (el: HTMLElement, x: number, y: number) => {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};
