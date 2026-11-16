import { stepDifferentialDrive, wheelAngleDelta } from '@robolab/robot-engine';
import { clamp, type Pose2D, type RobotDefinition, type SensorSnapshot, type WheelSpeeds } from '@robolab/shared';
import type { RobotVisualSource, RobotVisualState, RobotVisualStatus } from './RobotTypes';

interface MutableState {
  pose: Pose2D;
  motors: WheelSpeeds;
  wheelAngle: { left: number; right: number };
  linear: number;
  angular: number;
  status: RobotVisualStatus;
  sensors: SensorSnapshot;
}

/**
 * Kinematic robot runtime (UI 3). Holds the robot's live state in a plain
 * mutable object that the renderer reads every frame — no React state.
 *
 * API mirrors what the Robot Engine / physics will call later:
 * `setMotorSpeed`, `setSensorState`, `setRobotStatus`, `resetRobot`,
 * `setRobotPosition`, and `step(dt)` on a fixed timestep. When Rapier lands,
 * `step` delegates pose integration to physics and keeps the rest.
 */
export class RobotRuntime implements RobotVisualSource {
  private readonly s: MutableState;

  constructor(
    readonly definition: RobotDefinition,
    private spawn: Pose2D,
  ) {
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

  get state(): RobotVisualState {
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

  setRobotStatus(status: RobotVisualStatus): void {
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
