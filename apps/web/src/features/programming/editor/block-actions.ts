import type { BlockId } from '@robolab/blocks';
import { useProgramStore } from '../state/program-store';
import { workspaceRegistry } from './workspace-registry';

/** Short fade/scale-out, then delete (one undo step). */
export function deleteWithAnimation(id: BlockId): void {
  const el = workspaceRegistry.get()?.content.querySelector<HTMLElement>(`[data-block-root="${CSS.escape(id)}"]`);
  const remove = () => {
    useProgramStore.getState().deleteBlock(id);
  };
  if (!el?.animate) return remove();
  el.animate(
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.9)' },
    ],
    { duration: 140, easing: 'ease-in' },
  ).finished.then(remove, remove);
}

/** Small "snap" pop when a block lands. */
export function playSnap(el: HTMLElement | null): void {
  el?.animate?.(
    [
      { transform: 'scale(1.05)', filter: 'brightness(1.25)' },
      { transform: 'scale(0.985)', filter: 'brightness(1.05)' },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ],
    { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)' },
  );
}
