/**
 * @robolab/physics-engine — collision geometry and spatial queries.
 *
 * Status: `CollisionWorld` (2D static colliders from the map: raycasts,
 * footprint contacts) backs sensors and collision detection. The Rapier
 * rigid-body engine lands later behind the same `PhysicsQuery` contract.
 */
export { CARGO_RADIUS, CollisionWorld, type Collider, type ColliderKind, type Contact } from './collision-world.ts';
export type { PhysicsEngine, PhysicsQuery, PhysicsStepInput, PhysicsStepResult, RaycastHit } from '@robolab/shared';
