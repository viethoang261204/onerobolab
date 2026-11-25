import type { Pose2D, Vec3 } from './geometry.ts';
import type { RobotId } from './ids.ts';
import type { SensorMount } from './sensor.ts';

/** Static description of a differential-drive robot model. */
export interface RobotDefinition {
  readonly id: RobotId;
  readonly name: string;
  /** Distance between the two wheel contact points (m). */
  readonly wheelBase: number;
  readonly wheelRadius: number;
  /** Wheel width (m), used for rendering and collision. */
  readonly wheelWidth: number;
  /** Maximum wheel surface speed (m/s). Speed commands are 0–1 of this. */
  readonly maxWheelSpeed: number;
  /** Chassis bounding box (m): x = length, y = height, z = width. */
  readonly bodySize: Vec3;
  readonly mass: number;
  readonly sensors: readonly SensorMount[];
  /** Optional GLB asset path; the renderer falls back to a procedural model. */
  readonly modelUrl?: string;
}

/** Wheel surface speeds (m/s). Positive drives forward. */
export interface WheelSpeeds {
  readonly left: number;
  readonly right: number;
}

export interface BodyVelocity {
  /** Forward speed along heading (m/s). */
  readonly linear: number;
  /** Yaw rate (rad/s), positive = counter-clockwise from above. */
  readonly angular: number;
}

export type RobotStatus = 'idle' | 'running' | 'stopped' | 'crashed';

/** Dynamic robot state. Owned by the Robot Engine; pose is synced from physics. */
export interface RobotState {
  readonly id: RobotId;
  readonly pose: Pose2D;
  readonly velocity: BodyVelocity;
  /** Last wheel speeds commanded by the Robot Engine. */
  readonly wheelTargets: WheelSpeeds;
  readonly status: RobotStatus;
  /** Accumulated distance travelled (m), used by scoring. */
  readonly odometer: number;
}
