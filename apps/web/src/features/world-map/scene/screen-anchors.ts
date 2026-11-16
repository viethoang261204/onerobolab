/*
 * DOM elements pinned to 3D points. HTML labels live in the page (normal
 * React tree, normal tab order); the canvas projects each anchor's point to
 * screen space every frame and writes a transform — no React re-render and
 * no nested React roots.
 */

export interface ScreenAnchor {
  readonly el: HTMLElement;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Island order: follow that island's bob (see `islandBob`). */
  readonly bobWith?: number;
}

export const screenAnchors = new Map<string, ScreenAnchor>();

/** Ref-callback helper: `ref={anchorRef('label:starter', pos)}`. */
export function registerAnchor(id: string, el: HTMLElement | null, pos: Omit<ScreenAnchor, 'el'>): void {
  if (el) screenAnchors.set(id, { el, ...pos });
  else screenAnchors.delete(id);
}

/** Vertical bob of an island (scene units); shared by the island mesh and its anchors. */
export const islandBob = (order: number, t: number): number => Math.sin(t * 0.55 + order * 1.7) * 0.12;
