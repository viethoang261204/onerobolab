import type { Pose2D } from '../types/geometry';
import type { Program, ProgramStatus } from '../types/program';
import type { RobotDefinition, RobotState, WheelSpeeds } from '../types/robot';
import type { SensorSnapshot } from '../types/sensor';
import type { PhysicsStepResult } from './physics-engine';

export interface RobotTickInput {
  readonly dt: number;
  /** Readings sampled at the start of this tick. */
  readonly sensors: SensorSnapshot;
}

/**
 * Robot Engine: owns robot state and executes IR programs.
 *
 * Each tick: `update()` advances the interpreter and drive controller and
 * returns wheel targets for physics; `applyPhysics()` feeds the resulting pose
 * back (odometry closes the loop for distance/angle moves).
 */
export interface RobotEngine {
  readonly definition: RobotDefinition;
  reset(pose: Pose2D): void;
  loadProgram(program: Program): void;
  start(): void;
  pause(): void;
  resume(): void;
  /** Halts the program and commands zero wheel speed. */
  halt(): void;
  update(input: RobotTickInput): WheelSpeeds;
  applyPhysics(result: PhysicsStepResult): void;
  getState(): RobotState;
  getProgramStatus(): ProgramStatus;
}
