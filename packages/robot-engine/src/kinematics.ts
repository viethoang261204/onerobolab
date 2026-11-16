import type { BodyVelocity, Pose2D, WheelSpeeds } from '@robolab/shared';
import { normalizeAngle } from '@robolab/shared';

/** Body velocity of a differential-drive (or skid-steer) robot from wheel surface speeds. */
export function bodyVelocity(wheels: WheelSpeeds, trackWidth: number): BodyVelocity {
  return {
    linear: (wheels.left + wheels.right) / 2,
    // Right wheels faster → turn left (counter-clockwise from above, positive heading).
    angular: (wheels.right - wheels.left) / trackWidth,
  };
}

export interface DriveStep {
  readonly pose: Pose2D;
  readonly velocity: BodyVelocity;
  /** Distance travelled by the robot centre this step (m, ≥ 0). */
  readonly distance: number;
}

/**
 * Integrates one step of differential-drive kinematics with the exact arc
 * solution (no drift for constant wheel speeds). Pure and deterministic.
 * Heading convention: 0 = +X, forward = (cos h, −sin h).
 */
export function stepDifferentialDrive(pose: Pose2D, wheels: WheelSpeeds, trackWidth: number, dt: number): DriveStep {
  const velocity = bodyVelocity(wheels, trackWidth);
  const { linear: v, angular: w } = velocity;
  const h0 = pose.heading;
  let x: number;
  let z: number;
  if (Math.abs(w) < 1e-9) {
    x = pose.x + v * Math.cos(h0) * dt;
    z = pose.z - v * Math.sin(h0) * dt;
  } else {
    const h1 = h0 + w * dt;
    x = pose.x + (v / w) * (Math.sin(h1) - Math.sin(h0));
    z = pose.z + (v / w) * (Math.cos(h1) - Math.cos(h0));
  }
  return {
    pose: { x, z, heading: normalizeAngle(h0 + w * dt) },
    velocity,
    distance: Math.abs(v) * dt,
  };
}

/** Wheel rotation (rad) for a surface speed over `dt`. Positive = rolling forward. */
export const wheelAngleDelta = (surfaceSpeed: number, wheelRadius: number, dt: number): number =>
  (surfaceSpeed / wheelRadius) * dt;
