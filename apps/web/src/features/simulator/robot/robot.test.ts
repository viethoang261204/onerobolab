import { ROVER } from '@robolab/robot-engine';
import { describe, expect, it } from 'vitest';
import { bodyBob, displayFrame, headYawTarget } from './RobotAnimation';
import { RobotRuntime } from './RobotMovement';

const spawn = { x: 1, z: 2, heading: 0 };

describe('RobotRuntime', () => {
  it('drives forward and spins both wheel sides forward', () => {
    const r = new RobotRuntime(ROVER, spawn);
    r.setRobotStatus('running');
    r.setMotorSpeed(0.3, 0.3);
    for (let i = 0; i < 60; i++) r.step(1 / 60);
    expect(r.state.pose.x).toBeCloseTo(1.3, 6);
    expect(r.state.wheelAngle.left).toBeCloseTo(0.3 / ROVER.wheelRadius, 6);
    expect(r.state.wheelAngle.right).toBeCloseTo(0.3 / ROVER.wheelRadius, 6);
  });

  it('turns with different wheel speeds (left slower → turn left)', () => {
    const r = new RobotRuntime(ROVER, spawn);
    r.setRobotStatus('running');
    r.setMotorSpeed(0.1, 0.3);
    r.step(0.5);
    expect(r.state.pose.heading).toBeGreaterThan(0);
    expect(r.state.wheelAngle.right).toBeGreaterThan(r.state.wheelAngle.left);
  });

  it('clamps motor speed and stops motors when not running', () => {
    const r = new RobotRuntime(ROVER, spawn);
    r.setMotorSpeed(9, -9);
    expect(r.state.motors).toEqual({ left: ROVER.maxWheelSpeed, right: -ROVER.maxWheelSpeed });
    r.setRobotStatus('stopped');
    expect(r.state.motors).toEqual({ left: 0, right: 0 });
  });

  it('resets pose, wheels and status', () => {
    const r = new RobotRuntime(ROVER, spawn);
    r.setRobotStatus('running');
    r.setMotorSpeed(0.4, 0.2);
    for (let i = 0; i < 30; i++) r.step(1 / 60);
    r.resetRobot();
    expect(r.state.pose).toEqual(spawn);
    expect(r.state.wheelAngle).toEqual({ left: 0, right: 0 });
    expect(r.state.status).toBe('idle');
  });
});

describe('RobotAnimation', () => {
  it('keeps idle motion subtle', () => {
    for (let t = 0; t < 10; t += 0.37) {
      expect(Math.abs(bodyBob('idle', t))).toBeLessThan(0.005);
      const yaw = headYawTarget({ ...new RobotRuntime(ROVER, spawn).state, status: 'idle' }, t);
      expect(Math.abs(yaw)).toBeLessThanOrEqual((3 * Math.PI) / 180 + 1e-9);
    }
  });

  it('uses distinct display patterns per status', () => {
    expect(displayFrame('error', 0.1).color).not.toBe(displayFrame('idle', 0.1).color);
    expect(displayFrame('stopped', 1).eyeIntensity).toBeLessThan(displayFrame('running', 1).eyeIntensity);
  });
});
