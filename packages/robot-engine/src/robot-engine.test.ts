import { Vec2Math, type Pose2D, type Vec2 } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { ROVER } from './catalog.ts';
import { bodyVelocity, stepDifferentialDrive, wheelAngleDelta } from './kinematics.ts';
import { PathFollower } from './path-follower.ts';

const close = (a: number, b: number, digits = 9) => expect(a).toBeCloseTo(b, digits);
const DT = 1 / 60;

const distanceToPath = (path: readonly Vec2[], p: Vec2) =>
  Math.min(...path.slice(1).map((b, i) => Vec2Math.distanceToSegment(p, path[i] ?? b, b)));

/** Same shape as the built-in mission track (engines may not import the map engine). */
function course(): Vec2[] {
  const pts: Vec2[] = [{ x: -2.8, z: 1.8 }, { x: -0.8, z: 1.8 }];
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number) => {
    for (let i = 1; i <= 16; i++) {
      const a = a0 + ((a1 - a0) * i) / 16;
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
    }
  };
  arc(-0.8, 1.2, 0.6, Math.PI / 2, 0); // left turn onto −Z
  pts.push({ x: -0.2, z: -0.6 });
  arc(0.4, -0.6, 0.6, Math.PI, (3 * Math.PI) / 2); // right turn onto +X
  pts.push({ x: 2.6, z: -1.2 }, { x: 2.95, z: -1.2 });
  return pts;
}

describe('differential drive kinematics', () => {
  it('drives straight along the heading', () => {
    let pose: Pose2D = { x: 0, z: 0, heading: Math.PI / 2 };
    for (let i = 0; i < 60; i++) pose = stepDifferentialDrive(pose, { left: 0.5, right: 0.5 }, 0.2, DT).pose;
    close(pose.x, 0);
    close(pose.z, -0.5); // heading +90° faces −Z
  });

  it('turns in place when wheels spin opposite', () => {
    const v = bodyVelocity({ left: -0.1, right: 0.1 }, 0.2);
    close(v.linear, 0);
    close(v.angular, 1); // right faster → CCW (left turn)
    const step = stepDifferentialDrive({ x: 1, z: 2, heading: 0 }, { left: -0.1, right: 0.1 }, 0.2, 0.5);
    close(step.pose.x, 1);
    close(step.pose.z, 2);
    close(step.pose.heading, 0.5);
  });

  it('closes a full circle exactly (no integration drift)', () => {
    const track = 0.2;
    const wheels = { left: 0.2, right: 0.3 }; // ω = 0.5 rad/s
    let pose: Pose2D = { x: 0, z: 0, heading: 0 };
    const steps = Math.round((2 * Math.PI) / 0.5 / DT);
    for (let i = 0; i < steps; i++) pose = stepDifferentialDrive(pose, wheels, track, (2 * Math.PI) / 0.5 / steps).pose;
    close(pose.x, 0, 6);
    close(pose.z, 0, 6);
  });

  it('is deterministic', () => {
    const run = () => {
      let pose: Pose2D = { x: 0, z: 0, heading: 0 };
      for (let i = 0; i < 500; i++) pose = stepDifferentialDrive(pose, { left: 0.31, right: 0.27 + (i % 7) * 0.01 }, 0.24, DT).pose;
      return pose;
    };
    expect(run()).toEqual(run());
  });

  it('converts surface speed to wheel rotation', () => {
    close(wheelAngleDelta(0.5, 0.05, 1), 10);
  });
});

describe('PathFollower', () => {
  const options = {
    lookahead: 0.3,
    cruiseSpeed: 0.35,
    maxWheelSpeed: ROVER.maxWheelSpeed,
    trackWidth: ROVER.wheelBase,
    arriveTolerance: 0.06,
  };

  it('drives a curved course (straight, left 90°, straight, right 90°, straight) to the goal', () => {
    const path = course();
    const follower = new PathFollower(path, options);
    let pose: Pose2D = { x: -2.8, z: 1.8, heading: 0 };
    let maxOffTrack = 0;
    let done = false;
    for (let i = 0; i < 60 * 90 && !done; i++) {
      const cmd = follower.update(pose);
      done = cmd.done;
      pose = stepDifferentialDrive(pose, cmd.wheels, ROVER.wheelBase, DT).pose;
      maxOffTrack = Math.max(maxOffTrack, distanceToPath(path, pose));
    }
    expect(done).toBe(true);
    const goal = path[path.length - 1] ?? { x: NaN, z: NaN };
    expect(Math.hypot(pose.x - goal.x, pose.z - goal.z)).toBeLessThan(0.1);
    // Line sensor is ~5 cm wide: the robot centre must stay close to the line.
    expect(maxOffTrack).toBeLessThan(0.06);
  });

  it('never commands wheel speeds above the limit', () => {
    const follower = new PathFollower(
      [
        { x: 0, z: 0 },
        { x: 0.3, z: 0 },
        { x: 0.3, z: -0.3 },
      ],
      { ...options, cruiseSpeed: 2 },
    );
    const cmd = follower.update({ x: 0, z: 0, heading: 0 });
    expect(Math.max(Math.abs(cmd.wheels.left), Math.abs(cmd.wheels.right))).toBeLessThanOrEqual(ROVER.maxWheelSpeed + 1e-12);
  });
});
