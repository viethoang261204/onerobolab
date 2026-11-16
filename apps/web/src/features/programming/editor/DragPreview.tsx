import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDragStore } from '../state/drag-store';
import { StaticBlock } from './StaticBlock';
import { previewRegistry } from './workspace-registry';

/**
 * Semi-transparent copy of the dragged block that follows the pointer. The
 * drag controller moves it by writing `transform` directly (no re-render).
 */
export function DragPreview() {
  const session = useDragStore((s) => s.session);
  const willDelete = useDragStore((s) => s.overTrash);
  const register = useCallback((el: HTMLDivElement | null) => previewRegistry.set(el), []);
  if (!session) return null;
  return createPortal(
    <div
      ref={register}
      className="pointer-events-none fixed left-0 top-0 z-[70] origin-top-left transition-opacity duration-100 [&:not([data-placed])]:invisible"
      // transform is owned by the drag controller (never set from React)
      style={{ opacity: willDelete ? 0.4 : 0.9, filter: 'drop-shadow(0 14px 18px rgb(0 0 0 / 0.55))' }}
    >
      <StaticBlock fragment={session.fragment} id={session.fragment.rootId} stack />
    </div>,
    document.body,
  );
}
