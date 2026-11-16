import { create } from 'zustand';
import type { BlockFragment, BlockId, BlockShape, DropTarget } from '../blocks/block-types';

export interface DragSession {
  /** What is being dragged (rendered by the preview). */
  readonly fragment: BlockFragment;
  readonly shape: BlockShape;
  /** Set when an existing workspace block is moved. */
  readonly sourceId: BlockId | null;
  /** Stack members being moved (ghosted in place while dragging). */
  readonly chain: ReadonlySet<BlockId>;
}

/** Where the drop would land, in screen coordinates, for the indicator. */
export type DropHint =
  | { readonly kind: 'line'; readonly x: number; readonly y: number; readonly width: number }
  | { readonly kind: 'socket'; readonly x: number; readonly y: number; readonly width: number; readonly height: number };

interface DragState {
  session: DragSession | null;
  target: DropTarget | null;
  hint: DropHint | null;
  /** Pointer is over the toolbox / trash (drop = delete). */
  overTrash: boolean;
  set: (patch: Partial<Omit<DragState, 'set'>>) => void;
}

/**
 * Ephemeral drag state, kept apart from the program store so dragging never
 * re-renders the workspace (only the preview, indicator and ghosted blocks
 * subscribe). The preview position is written straight to the DOM.
 */
export const useDragStore = create<DragState>()((set) => ({
  session: null,
  target: null,
  hint: null,
  overTrash: false,
  set: (patch) => set(patch),
}));
