import type { Pose2D } from './geometry.ts';
import type { EntityId } from './ids.ts';
import type { MissionState } from './mission.ts';
import type { ProgramStatus } from './program.ts';
import type { RobotState } from './robot.ts';
import type { ScoreBreakdown } from './scoring.ts';
import type { SensorSnapshot } from './sensor.ts';

/** Fixed-timestep configuration. Determinism depends on a constant `fixedDt`. */
export interface SimulationConfig {
  /** Seconds per simulation tick (default 1/60). */
  readonly fixedDt: number;
  /** Max ticks per rendered frame, prevents a spiral of death on slow frames. */
  readonly maxTicksPerFrame: number;
  /** Playback speed multiplier (1 = real time). */
  readonly timeScale: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  fixedDt: 1 / 60,
  maxTicksPerFrame: 5,
  timeScale: 1,
};

/** Robot contact with the world during one tick. */
export interface ContactEvent {
  /** Entity hit, or 'boundary' for the map edge. */
  readonly target: EntityId | 'boundary';
  /** Relative speed at impact (m/s). */
  readonly impactSpeed: number;
  /** true on the first tick of contact, false while contact persists. */
  readonly started: boolean;
}

/** Pose of a dynamic (pushable) map entity, for rendering. */
export interface DynamicEntityPose {
  readonly id: EntityId;
  readonly pose: Pose2D;
}

/** A crate set down by the robot. */
export interface CargoDrop {
  readonly itemId: string;
  /** Delivery zone it landed in, or null (floor). */
  readonly zoneId: EntityId | null;
  /** In a delivery zone that accepts it (colour matches when the zone has one). */
  readonly correct: boolean;
}

/** State of the interactive world objects (gates, cargo) after a tick. */
export interface WorldSnapshot {
  /** Crate the robot carries, or null. */
  readonly carrying: string | null;
  readonly drops: readonly CargoDrop[];
  readonly openGates: readonly EntityId[];
}

export type SimulationPhase = 'unloaded' | 'ready' | 'running' | 'paused' | 'ended';

/**
 * Immutable picture of the world after a tick. The Mission Engine observes it,
 * the renderer draws it, the UI displays it. Nothing mutates it.
 */
export interface SimulationSnapshot {
  readonly tick: number;
  /** Simulation time (s) = tick * fixedDt. */
  readonly time: number;
  readonly phase: SimulationPhase;
  readonly robot: RobotState;
  readonly sensors: SensorSnapshot;
  readonly program: ProgramStatus;
  readonly contacts: readonly ContactEvent[];
  readonly dynamicEntities: readonly DynamicEntityPose[];
  /** Interactive objects; absent on maps without any. */
  readonly world?: WorldSnapshot;
}

export type SimulationEvent =
  | { readonly type: 'phaseChanged'; readonly phase: SimulationPhase }
  | { readonly type: 'missionChanged'; readonly mission: MissionState }
  | { readonly type: 'finished'; readonly mission: MissionState; readonly score: ScoreBreakdown }
  | { readonly type: 'programError'; readonly message: string; readonly blockId: string | null };
