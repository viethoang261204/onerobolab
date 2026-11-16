/**
 * Handle to the mounted workspace, so code outside its React tree (toolbox
 * drags, keyboard shortcuts) can convert coordinates and query connection
 * points. Only one block workspace exists at a time.
 */
export interface WorkspaceHandle {
  /** Visible workspace area (for hit-testing drops). */
  readonly viewport: HTMLElement;
  /** Transformed content layer that holds the blocks. */
  readonly content: HTMLElement;
  zoom(): number;
  /** Screen point → workspace content coordinates. */
  toContent(x: number, y: number): { x: number; y: number };
  /** Scroll/zoom so that a content point is visible. */
  reveal(x: number, y: number): void;
}

let handle: WorkspaceHandle | null = null;

export const workspaceRegistry = {
  set(h: WorkspaceHandle | null): void {
    handle = h;
  },
  get(): WorkspaceHandle | null {
    return handle;
  },
};

/** Preview element (moved directly during drags, no React state). */
let previewEl: HTMLElement | null = null;
export const previewRegistry = {
  set(el: HTMLElement | null): void {
    previewEl = el;
  },
  get(): HTMLElement | null {
    return previewEl;
  },
};
