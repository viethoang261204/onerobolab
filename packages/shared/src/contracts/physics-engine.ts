import type { Pose2D, Vec3 } from '../types/geometry.ts';
import type { EntityId } from '../types/ids.ts';
import type { BodyVelocity, RobotDefinition, WheelSpeeds } from '../types/robot.ts';
import type { ContactEvent, DynamicEntityPose } from '../types/simulation.ts';
import type { MapQuery } from './map-engine.ts';

export interface RaycastHit {
  readonly distance: number;
  readonly point: Vec3;
  /** Entity hit, or null for the map boundary. */
  readonly entityId: EntityId | null;
}

/** Read-only spatial queries. This is all the Sensor Engine may use from physics. */
export interface PhysicsQuery {
  /** `direction` must be normalised. Ignores the robot's own collider. */
  raycast(origin: Vec3, direction: Vec3, maxDistance: number): RaycastHit | null;
  /** Entities overlapping an oriented box (touch sensors). */
  overlapBox(center: Vec3, halfExtents: Vec3, heading: number): readonly (EntityId | 'boundary')[];
}

export interface PhysicsStepInput {
  readonly dt: number;
  readonly wheelTargets: WheelSpeeds;
}

export interface PhysicsStepResult {
  readonly pose: Pose2D;
  readonly velocity: BodyVelocity;
  readonly contacts: readonly ContactEvent[];
  readonly dynamicEntities: readonly DynamicEntityPose[];
}

/**
 * Physics Engine: owns rigid bodies and colliders. Implemented with Rapier;
 * a kinematic implementation can back unit tests. Must be deterministic for a
 * given sequence of inputs.
 */
export interface PhysicsEngine extends PhysicsQuery {
  /** Async because Rapier loads WASM. */
  init(map: MapQuery, robot: RobotDefinition, start: Pose2D): Promise<void>;
  resetRobot(pose: Pose2D): void;
  step(input: PhysicsStepInput): PhysicsStepResult;
  dispose(): void;
}
