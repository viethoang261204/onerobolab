import type { DecalPlacement, RobotModelId } from '../model/robot-config';

/*
 * Where accessories and decals attach on each model, in robot design units
 * (the rover's: +X forward, +Y up, +Z right; wheel radius 0.16). Swapping a
 * procedural model for a GLB later means updating these points only.
 */

export type Vec3 = readonly [number, number, number];

export interface Mounts {
  /** Top of the head. */
  readonly headTop: Vec3;
  /** Back of the body (packs, flags). */
  readonly back: Vec3;
  /** Right side of the body (+Z); the left side mirrors it. */
  readonly side: Vec3;
  /** Front face. */
  readonly front: Vec3;
  /** Flat top surface (panels). */
  readonly deck: Vec3;
}

export interface DecalAnchor {
  readonly p: Vec3;
  /** Rotation of a +Z-facing plane (x, y). */
  readonly r: readonly [number, number];
  readonly size: number;
}

const SIDE_R: readonly [number, number] = [0, 0];
const SIDE_L: readonly [number, number] = [0, Math.PI];
const FRONT: readonly [number, number] = [0, Math.PI / 2];
const TOP: readonly [number, number] = [-Math.PI / 2, 0];

export const MOUNTS: Readonly<Record<RobotModelId, Mounts>> = {
  rover: { headTop: [-0.08, 0.88, 0], back: [-0.25, 0.53, 0], side: [-0.02, 0.36, 0.235], front: [0.33, 0.47, 0], deck: [0.08, 0.53, 0] },
  scout: { headTop: [-0.05, 0.74, 0], back: [-0.26, 0.3, 0], side: [0.02, 0.22, 0.16], front: [0.3, 0.22, 0], deck: [0.08, 0.28, 0] },
  tank: { headTop: [-0.02, 0.56, 0], back: [-0.3, 0.4, 0], side: [0, 0.3, 0.3], front: [0.31, 0.33, 0], deck: [0.16, 0.38, 0] },
  biped: { headTop: [0, 0.88, 0], back: [-0.13, 0.54, 0], side: [0, 0.5, 0.2], front: [0.11, 0.55, 0], deck: [-0.02, 0.66, 0] },
};

export const DECAL_ANCHORS: Readonly<Record<RobotModelId, Partial<Record<DecalPlacement, DecalAnchor>>>> = {
  rover: {
    'side-left': { p: [-0.17, 0.37, -0.2125], r: SIDE_L, size: 0.11 },
    'side-right': { p: [-0.17, 0.37, 0.2125], r: SIDE_R, size: 0.11 },
    top: { p: [0.1, 0.5285, 0], r: TOP, size: 0.12 },
    front: { p: [0.3235, 0.462, 0], r: FRONT, size: 0.07 },
  },
  scout: {
    'side-left': { p: [-0.02, 0.21, -0.1515], r: SIDE_L, size: 0.09 },
    'side-right': { p: [-0.02, 0.21, 0.1515], r: SIDE_R, size: 0.09 },
    top: { p: [0.06, 0.2815, 0], r: TOP, size: 0.1 },
  },
  tank: {
    'side-left': { p: [0.02, 0.28, -0.1815], r: SIDE_L, size: 0.12 },
    'side-right': { p: [0.02, 0.28, 0.1815], r: SIDE_R, size: 0.12 },
    front: { p: [0.2815, 0.3, 0], r: FRONT, size: 0.1 },
    head: { p: [-0.02, 0.43, 0.1315], r: SIDE_R, size: 0.08 },
  },
  biped: {
    front: { p: [0.1015, 0.5, 0], r: FRONT, size: 0.1 },
    head: { p: [0, 0.78, 0.1015], r: SIDE_R, size: 0.07 },
  },
};
