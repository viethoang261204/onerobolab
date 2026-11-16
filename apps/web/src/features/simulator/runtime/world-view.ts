import type { CargoItem, EntityId, MoverEntity, Pose2D, Vec2 } from '@robolab/shared';
import type { PlacedCrate } from '@robolab/world-engine';
import type { SimulationRuntime } from './SimulationRuntime';

/**
 * What the renderer may read about the interactive world, every frame:
 * crate poses, gates, cargo stacks, the crate on the robot, crates set down,
 * patrolling obstacles and the run clock (traffic lights). Pulled in
 * `useFrame` — never pushed through React state.
 */
export interface WorldView {
  readonly time: () => number;
  readonly crates: () => readonly { readonly id: EntityId; readonly pose: Pose2D }[];
  readonly isGateOpen: (id: EntityId) => boolean;
  readonly stack: (id: EntityId) => readonly CargoItem[];
  readonly carried: () => CargoItem | null;
  readonly placed: () => readonly PlacedCrate[];
  readonly moverAt: (m: MoverEntity) => Vec2;
}

let current: WorldView | null = null;

/** The view of the simulation that is running now (null in previews / before the runtime exists). */
export const getWorldView = (): WorldView | null => current;

/** Publish a runtime's world; returns the cleanup that withdraws it again. */
export function publishWorld(sim: SimulationRuntime): () => void {
  const view: WorldView = {
    time: () => sim.clock,
    crates: () => sim.collisionWorld.cratePoses(),
    isGateOpen: (id) => sim.worldObjects.isGateOpen(id),
    stack: (id) => sim.worldObjects.stack(id),
    carried: () => sim.worldObjects.carried,
    placed: () => sim.worldObjects.placedCrates,
    moverAt: (m) => sim.collisionWorld.moverAt(m),
  };
  current = view;
  return () => {
    if (current === view) current = null;
  };
}
