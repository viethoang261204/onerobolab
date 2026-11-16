/**
 * @robolab/robot-engine — robot catalogue, exact differential-drive
 * kinematics, the pure-pursuit demo autopilot, and the IR interpreter
 * (`CommandQueue`) that executes compiled block programs.
 */
export { ROVER } from './catalog';
export { bodyVelocity, stepDifferentialDrive, wheelAngleDelta, type DriveStep } from './kinematics';
export { PathFollower, type FollowCommand, type PathFollowerOptions } from './path-follower';
export { CommandQueue, GRIP_SECONDS, type CommandArgs, type CommandEvent, type CommandQueueOptions, type TickInput, type TickOutput } from './interpreter/command-queue';
export { evaluate, evaluateBool, evaluateNumber, ProgramProblem, type EvalContext } from './interpreter/evaluate';
export type { RobotEngine, RobotTickInput } from '@robolab/shared';
