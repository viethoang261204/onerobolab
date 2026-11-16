import type { Pose2D, SensorSnapshot, WheelSpeeds } from '@robolab/shared';
import type { RefObject } from 'react';
import type { Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * Visual status of the robot (display, LEDs, head behaviour). Broader than the
 * engine's `RobotStatus` because it includes mission outcomes.
 */
export type RobotVisualStatus = 'idle' | 'running' | 'stopped' | 'success' | 'error';

/** Everything the renderer needs each frame. Read via refs in `useFrame`, never via React state. */
export interface RobotVisualState {
  readonly pose: Pose2D;
  /** Commanded wheel surface speeds (m/s). */
  readonly motors: WheelSpeeds;
  /** Accumulated wheel rotation (rad) per side; positive = rolling forward. */
  readonly wheelAngle: { readonly left: number; readonly right: number };
  /** Body velocity (m/s, rad/s). */
  readonly linear: number;
  readonly angular: number;
  readonly status: RobotVisualStatus;
  readonly sensors: SensorSnapshot;
}

/** Pull interface between whatever drives the robot (demo autopilot, later the engine) and the renderer. */
export interface RobotVisualSource {
  readonly state: RobotVisualState;
}

/**
 * Model dimensions in "design units" (the reference proportions: ~0.72 m
 * long). The rendered robot is scaled so the wheel radius matches the
 * physical `RobotDefinition.wheelRadius`, keeping visuals and kinematics in sync.
 */
export const DESIGN = {
  wheelRadius: 0.16,
  wheelWidth: 0.14,
  /** Wheel centre X (front +, rear −). */
  wheelX: 0.24,
  /** Wheel centre Z (± side). */
  wheelZ: 0.27,
  chassisY: 0.2,
  shellY: 0.355,
  deckTopY: 0.515,
} as const;

/** Independently addressable parts, for animation now and physics/engine control later. */
export interface RobotRig {
  readonly root: RefObject<Group | null>;
  readonly body: RefObject<Group | null>;
  readonly headYaw: RefObject<Group | null>;
  readonly headPitch: RefObject<Group | null>;
  readonly wheels: {
    readonly frontLeft: RefObject<Group | null>;
    readonly frontRight: RefObject<Group | null>;
    readonly rearLeft: RefObject<Group | null>;
    readonly rearRight: RefObject<Group | null>;
  };
  readonly display: {
    readonly leftEye: RefObject<Mesh | null>;
    readonly rightEye: RefObject<Mesh | null>;
  };
}

/** Materials whose parameters are animated per frame (owned per robot instance). */
export interface AnimatedMaterials {
  readonly eyes: MeshStandardMaterial;
  readonly frontLed: MeshStandardMaterial;
  readonly accentLed: MeshStandardMaterial;
  readonly lens: MeshStandardMaterial;
}
