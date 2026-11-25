import { clamp, Vec2Math, type Pose2D, type Vec2, type WheelSpeeds } from '@robolab/shared';

export interface PathFollowerOptions {
  /** Look-ahead distance (m). Larger = smoother, cuts corners more. */
  readonly lookahead: number;
  /** Cruise speed on straights (m/s). */
  readonly cruiseSpeed: number;
  /** Hard cap for any wheel surface speed (m/s). */
  readonly maxWheelSpeed: number;
  /** Track width used to split body motion into wheel speeds (m). */
  readonly trackWidth: number;
  /** Stop when within this distance of the final point (m). */
  readonly arriveTolerance: number;
}

export interface FollowCommand {
  readonly wheels: WheelSpeeds;
  /** Signed path curvature being tracked (1/m, + = left). */
  readonly curvature: number;
  readonly done: boolean;
}

/**
 * Pure-pursuit path follower producing differential wheel speeds.
 *
 * This is the *demo autopilot* used until programs drive the robot (Blockly
 * → IR → interpreter). Progress along the path only moves forward, so
 * self-approaching or crossing paths don't cause jumps. Deterministic.
 */
export class PathFollower {
  private progress = 0;
  private readonly cumulative: number[];
  private readonly total: number;
  private readonly path: readonly Vec2[];
  private readonly options: PathFollowerOptions;

  constructor(path: readonly Vec2[], options: PathFollowerOptions) {
    this.path = path;
    this.options = options;
    if (path.length < 2) throw new Error('PathFollower needs at least two points.');
    this.cumulative = [0];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      this.cumulative.push((this.cumulative[i - 1] ?? 0) + (a && b ? Vec2Math.distance(a, b) : 0));
    }
    this.total = this.cumulative[this.cumulative.length - 1] ?? 0;
  }

  reset(): void {
    this.progress = 0;
  }

  /** Arc-length position (m) of the point nearest to `p`, searched forward from current progress. */
  private project(p: Vec2): number {
    let best = this.progress;
    let bestDist = Infinity;
    const window = this.progress + 1.0; // only search a short distance ahead
    for (let i = 0; i < this.path.length - 1; i++) {
      const s0 = this.cumulative[i] ?? 0;
      const s1 = this.cumulative[i + 1] ?? 0;
      if (s1 < this.progress || s0 > window) continue;
      const a = this.path[i];
      const b = this.path[i + 1];
      if (!a || !b) continue;
      const ab = Vec2Math.sub(b, a);
      const len2 = Vec2Math.dot(ab, ab) || 1;
      const t = clamp(Vec2Math.dot(Vec2Math.sub(p, a), ab) / len2, 0, 1);
      const q = Vec2Math.add(a, Vec2Math.scale(ab, t));
      const d = Vec2Math.distance(p, q);
      const s = s0 + t * (s1 - s0);
      if (d < bestDist && s >= this.progress) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  private pointAt(s: number): Vec2 {
    const target = clamp(s, 0, this.total);
    for (let i = 0; i < this.path.length - 1; i++) {
      const s0 = this.cumulative[i] ?? 0;
      const s1 = this.cumulative[i + 1] ?? 0;
      const a = this.path[i];
      const b = this.path[i + 1];
      if (a && b && target <= s1) {
        const t = s1 > s0 ? (target - s0) / (s1 - s0) : 0;
        return Vec2Math.add(a, Vec2Math.scale(Vec2Math.sub(b, a), t));
      }
    }
    return this.path[this.path.length - 1] ?? { x: 0, z: 0 };
  }

  update(pose: Pose2D): FollowCommand {
    const o = this.options;
    const here = { x: pose.x, z: pose.z };
    this.progress = this.project(here);
    const end = this.path[this.path.length - 1] ?? here;
    if (this.total - this.progress < o.arriveTolerance && Vec2Math.distance(here, end) < o.arriveTolerance) {
      return { wheels: { left: 0, right: 0 }, curvature: 0, done: true };
    }

    const goal = this.pointAt(this.progress + o.lookahead);
    const toGoal = Vec2Math.sub(goal, here);
    const left = Vec2Math.headingToVector(pose.heading + Math.PI / 2);
    const lateral = Vec2Math.dot(toGoal, left);
    const d2 = Math.max(1e-6, Vec2Math.dot(toGoal, toGoal));
    const curvature = (2 * lateral) / d2;

    // Slow down in curves and when approaching the end.
    const remaining = this.total - this.progress;
    const speed = o.cruiseSpeed / (1 + 0.35 * Math.abs(curvature)) * clamp(remaining / 0.4, 0.35, 1);
    const w = speed * curvature;
    let l = speed - (w * o.trackWidth) / 2;
    let r = speed + (w * o.trackWidth) / 2;
    const peak = Math.max(Math.abs(l), Math.abs(r));
    if (peak > o.maxWheelSpeed) {
      l *= o.maxWheelSpeed / peak;
      r *= o.maxWheelSpeed / peak;
    }
    return { wheels: { left: l, right: r }, curvature, done: false };
  }
}
