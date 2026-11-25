import type { MapDefinition } from '../types/map.ts';
import type { MissionDefinition, MissionState } from '../types/mission.ts';
import type { Program } from '../types/program.ts';
import type { RobotDefinition } from '../types/robot.ts';
import type { SimulationConfig, SimulationEvent, SimulationSnapshot } from '../types/simulation.ts';

export interface SimulationSetup {
  readonly map: MapDefinition;
  readonly robot: RobotDefinition;
  readonly mission: MissionDefinition | null;
  readonly config?: Partial<SimulationConfig>;
}

export interface RunRequest {
  readonly program: Program;
  readonly blockCount: number;
}

export type SimulationListener = (event: SimulationEvent) => void;

/**
 * Simulation Controller: the only orchestrator. Owns the fixed-timestep loop
 * and wires the engines in a fixed order each tick:
 *
 *   sensors.sample → robot.update → physics.step → robot.applyPhysics
 *   → mission.observe → (on terminal state) scoring.score
 *
 * The UI talks to the simulation only through this interface.
 */
export interface SimulationController {
  load(setup: SimulationSetup): Promise<void>;
  run(request: RunRequest): void;
  pause(): void;
  resume(): void;
  /** Back to the start pose, program unloaded, mission reset. */
  reset(): void;
  /** Execute exactly one tick (debug stepping and tests). */
  step(): void;
  /**
   * Accumulate real elapsed time and run as many fixed ticks as fit
   * (capped by `maxTicksPerFrame`). Called from the render loop.
   * Returns the number of ticks executed.
   */
  advance(realDeltaSeconds: number): number;
  getSnapshot(): SimulationSnapshot;
  getMissionState(): MissionState | null;
  /** Low-frequency events only; per-tick data is pulled via `getSnapshot()`. */
  subscribe(listener: SimulationListener): () => void;
  dispose(): void;
}
