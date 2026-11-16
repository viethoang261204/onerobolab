import { useEffect } from 'react';
import { START_ID } from '../blocks/block-model';
import type { BlockId } from '../blocks/block-types';
import { buildParentIndex } from '../blocks/block-utils';
import { useProgramStore } from '../state/program-store';
import { deleteWithAnimation } from './block-actions';

/** True while the user's last pointer interaction was inside the editor or toolbox. */
let editorActive = false;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Neighbour for arrow-key navigation inside the block tree. */
function neighbour(id: BlockId, key: string): BlockId | null {
  const { program } = useProgramStore.getState();
  const block = program.blocks[id];
  if (!block) return null;
  const index = buildParentIndex(program);
  const parentOf = (bid: BlockId): BlockId | null => {
    // walk up through `next` links to the stack head, then to its container
    let cur = bid;
    for (let ref = index.get(cur); ref?.kind === 'next'; ref = index.get(cur)) cur = ref.id;
    const ref = index.get(cur);
    return ref && ref.kind !== 'root' ? ref.id : null;
  };
  switch (key) {
    case 'ArrowDown':
      return block.next;
    case 'ArrowUp': {
      const ref = index.get(id);
      return ref && ref.kind !== 'root' ? ref.id : null;
    }
    case 'ArrowRight':
      return Object.values(block.slots).find(Boolean) ?? Object.values(block.inputs).find(Boolean) ?? null;
    case 'ArrowLeft':
      return parentOf(id);
    default:
      return null;
  }
}

/**
 * Editor keyboard shortcuts (only while the editor is the active area, and
 * never while typing in a field):
 *   Ctrl/⌘+Z undo · Ctrl/⌘+Shift+Z or Ctrl+Y redo · Ctrl/⌘+C copy ·
 *   Ctrl/⌘+V paste · Ctrl/⌘+D duplicate · Delete/Backspace delete ·
 *   Arrows move the selection · Escape deselects (and cancels drags).
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      editorActive = e.target instanceof Element && !!e.target.closest('[data-editor-area]');
    };
    const onKey = (e: KeyboardEvent) => {
      if (!editorActive || isTyping(e.target)) return;
      const s = useProgramStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      let handled = true;
      if (mod && key === 'z' && !e.shiftKey) s.undo();
      else if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) s.redo();
      else if (mod && key === 'c') s.copy();
      else if (mod && key === 'v') s.paste();
      else if (mod && key === 'd' && s.selectedId) s.duplicateBlock(s.selectedId);
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId && s.selectedId !== START_ID) deleteWithAnimation(s.selectedId);
      else if (e.key === 'Escape') s.select(null);
      else if (e.key.startsWith('Arrow') && s.selectedId) {
        const next = neighbour(s.selectedId, e.key);
        if (next) s.select(next);
      } else handled = false;
      if (handled) e.preventDefault(); // e.g. Backspace must not navigate back
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}
