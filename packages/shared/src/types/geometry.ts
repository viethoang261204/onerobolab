/**
 * World conventions (used everywhere in RoboLab):
 * - Units: metres, seconds, radians. Blockly-facing values (degrees, cm,
 *   percent) are converted at compile time.
 * - Right-handed, Y up. The ground is the XZ plane.
 * - Heading 0 faces +X. Positive heading turns counter-clockwise when viewed
 *   from above, i.e. from +X toward -Z (matches a positive rotation about +Y).
 */
export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Position on the ground plane plus heading in radians. */
export interface Pose2D {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

/** Axis-aligned rectangle on the ground plane. */
export interface Rect2D {
  readonly min: Vec2;
  readonly max: Vec2;
}

/** Ground-plane region used for checkpoints, finish areas and colour zones. */
export type Area2D =
  | {
      readonly shape: 'rect';
      readonly center: Vec2;
      readonly size: Vec2;
      /** Rotation about +Y (rad). */
      readonly rotation: number;
    }
  | { readonly shape: 'circle'; readonly center: Vec2; readonly radius: number };
