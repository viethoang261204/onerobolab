import type { AdventureLayout, Pt } from './adventure.types';

/*
 * Adventure-map camera maths (pure). A fixed, angled view (like the Explore
 * screen) looking at a ground target from `distance`; the student pans the
 * target and zooms the distance, both kept inside the island.
 */

/** Look-down angle (radians from horizontal). */
export const PITCH = 0.9;
/** Vertical field of view (degrees). */
export const FOV = 34;
export const MIN_DISTANCE = 10;
export const MAX_DISTANCE = 60;
/** "Zoom 1": a few missions around the target in view. */
export const FOCUS_DISTANCE = 26;

export interface CamState {
  readonly x: number;
  readonly z: number;
  readonly distance: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

type Bounds = AdventureLayout['bounds'];

export const clampDistance = (d: number) => Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d));

/** Keep the target on the island (a little looser when zoomed out). */
export function clampCam(c: CamState, b: Bounds): CamState {
  const distance = clampDistance(c.distance);
  const slack = 1 + (distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE);
  return {
    distance,
    x: Math.min(b.maxX - 4 / slack, Math.max(b.minX + 4 / slack, c.x)),
    z: Math.min(b.maxZ, Math.max(b.minZ + 2, c.z)),
  };
}

/** World units per screen pixel at the target (for dragging). */
export const unitsPerPixel = (distance: number, view: Size) => (2 * distance * Math.tan((FOV * Math.PI) / 360)) / Math.max(1, view.height);

/** Drag by (dx, dy) screen pixels: the ground follows the pointer. */
export function panBy(c: CamState, dx: number, dy: number, view: Size, b: Bounds): CamState {
  const u = unitsPerPixel(c.distance, view);
  return clampCam({ ...c, x: c.x - dx * u, z: c.z - (dy * u) / Math.sin(PITCH) }, b);
}

/** Zoom by `factor` (> 1 = closer) towards the ground point under `anchor` (px from the view centre). */
export function zoomBy(c: CamState, factor: number, anchor: Pt, view: Size, b: Bounds): CamState {
  const distance = clampDistance(c.distance / factor);
  const u = unitsPerPixel(c.distance, view);
  const k = 1 - distance / c.distance;
  return clampCam({ distance, x: c.x + anchor.x * u * k, z: c.z + (anchor.y * u * k) / Math.sin(PITCH) }, b);
}

/** Distance at which the whole island fits the view. */
export function overviewDistance(view: Size, b: Bounds): number {
  const tan = Math.tan((FOV * Math.PI) / 360);
  const aspect = view.width / Math.max(1, view.height);
  const byWidth = (b.maxX - b.minX + 8) / 2 / (tan * aspect);
  const byDepth = ((b.maxZ - b.minZ + 6) * Math.sin(PITCH)) / 2 / tan;
  return clampDistance(Math.max(byWidth, byDepth));
}

/** Camera position for a state. */
export const cameraPosition = (c: CamState): [number, number, number] => [c.x, Math.sin(PITCH) * c.distance, c.z + Math.cos(PITCH) * c.distance];

/** Frame-rate independent approach of `a` to `b`. */
export function approach(a: CamState, b: CamState, dt: number, rate = 5): CamState {
  const k = 1 - Math.exp(-dt * rate);
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, distance: a.distance + (b.distance - a.distance) * k };
}
