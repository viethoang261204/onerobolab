import { stepDifferentialDrive, wheelAngleDelta } from '@robolab/robot-engine';
import { clamp, type Pose2D, type RobotDefinition, type SensorSnapshot, type WheelSpeeds } from '@robolab/shared';

/**
 * What the robot is doing, for the robot's display / LEDs and run outcomes.
 * Broader than the engine's `RobotStatus` because it includes mission results.
 */
export type RobotActivity = 'idle' | 'running' | 'stopped' | 'success' | 'error';

/** The robot's live state, read every frame by the renderer (never via React state). */
export interface RobotBodyState {
  readonly pose: Pose2D;
  /** Commanded wheel surface speeds (m/s). */
  readonly motors: WheelSpeeds;
  /** Accumulated wheel rotation (rad) per side; positive = rolling forward. */
  readonly wheelAngle: { readonly left: number; readonly right: number };
  /** Body velocity (m/s, rad/s). */
  readonly linear: number;
  readonly angular: number;
  readonly status: RobotActivity;
  readonly sensors: SensorSnapshot;
}

interface MutableState {
  pose: Pose2D;
  motors: WheelSpeeds;
  wheelAngle: { left: number; right: number };
  linear: number;
  angular: number;
  status: RobotActivity;
  sensors: SensorSnapshot;
}

/**
 * Kinematic robot body: differential-drive pose integration on the fixed
 * timestep, motor limits, status and the latest sensor reading. Holds its
 * state in one plain mutable object so a renderer can read it per frame.
 *
 * Framework-free: the simulator renders it, the API judge runs it headless.
 */
export class RobotBody {
  readonly definition: RobotDefinition;
  private spawn: Pose2D;
  private readonly s: MutableState;

  constructor(definition: RobotDefinition, spawn: Pose2D) {
    this.definition = definition;
    this.spawn = spawn;
    this.s = {
      pose: spawn,
      motors: { left: 0, right: 0 },
      wheelAngle: { left: 0, right: 0 },
      linear: 0,
      angular: 0,
      status: 'idle',
      sensors: {},
    };
  }

  get state(): RobotBodyState {
    return this.s;
  }

  /** Wheel surface speeds (m/s), clamped to the robot's limit. */
  setMotorSpeed(left: number, right: number): void {
    const max = this.definition.maxWheelSpeed;
    this.s.motors = { left: clamp(left, -max, max), right: clamp(right, -max, max) };
  }

  setSensorState(sensors: SensorSnapshot): void {
    this.s.sensors = sensors;
  }

  setRobotStatus(status: RobotActivity): void {
    this.s.status = status;
    if (status !== 'running') this.setMotorSpeed(0, 0);
  }

  /** Teleport without resetting wheels or status. */
  setRobotPosition(pose: Pose2D): void {
    this.s.pose = pose;
  }

  /** Back to spawn (or a new spawn): pose, wheels, motors, sensors and status reset. */
  resetRobot(spawn: Pose2D = this.spawn): void {
    this.spawn = spawn;
    this.s.pose = spawn;
    this.s.motors = { left: 0, right: 0 };
    this.s.wheelAngle = { left: 0, right: 0 };
    this.s.linear = 0;
    this.s.angular = 0;
    this.s.sensors = {};
    this.s.status = 'idle';
  }

  /** Advance kinematics by one fixed step. */
  step(dt: number): void {
    const { definition: d, s } = this;
    const result = stepDifferentialDrive(s.pose, s.motors, d.wheelBase, dt);
    s.pose = result.pose;
    s.linear = result.velocity.linear;
    s.angular = result.velocity.angular;
    s.wheelAngle = {
      left: s.wheelAngle.left + wheelAngleDelta(s.motors.left, d.wheelRadius, dt),
      right: s.wheelAngle.right + wheelAngleDelta(s.motors.right, d.wheelRadius, dt),
    };
  }
}
