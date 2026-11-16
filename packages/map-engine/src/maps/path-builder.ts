import { Vec2Math, type Pose2D, type Vec2 } from '@robolab/shared';

/** Segments per radian when approximating arcs (≈ one point every 6°). */
const ARC_SEGMENTS_PER_RAD = 10;

/**
 * Turtle-style authoring helper for line paths. Follows the world heading
 * convention (0 = +X, positive = counter-clockwise from above), so a map
 * author can write "straight 2 m, turn left 90° with radius 0.6 m, …".
 */
export class PathBuilder {
  private readonly pts: Vec2[];
  private x: number;
  private z: number;
  private heading: number;

  constructor(start: Pose2D) {
    this.x = start.x;
    this.z = start.z;
    this.heading = start.heading;
    this.pts = [{ x: start.x, z: start.z }];
  }

  straight(distance: number): this {
    const f = Vec2Math.headingToVector(this.heading);
    this.x += f.x * distance;
    this.z += f.z * distance;
    this.pts.push({ x: this.x, z: this.z });
    return this;
  }

  /** Circular arc. Positive `angle` turns left (CCW), negative turns right. */
  arc(radius: number, angle: number): this {
    const side = Math.sign(angle);
    const toCenter = Vec2Math.headingToVector(this.heading + (side * Math.PI) / 2);
    const center = { x: this.x + toCenter.x * radius, z: this.z + toCenter.z * radius };
    const offset = { x: this.x - center.x, z: this.z - center.z };
    const steps = Math.max(2, Math.ceil(Math.abs(angle) * ARC_SEGMENTS_PER_RAD));
    for (let i = 1; i <= steps; i++) {
      const p = Vec2Math.add(center, Vec2Math.rotate(offset, (angle * i) / steps));
      this.pts.push(p);
    }
    const end = this.pts[this.pts.length - 1];
    if (end) {
      this.x = end.x;
      this.z = end.z;
    }
    this.heading += angle;
    return this;
  }

  get pose(): Pose2D {
    return { x: this.x, z: this.z, heading: this.heading };
  }

  points(): readonly Vec2[] {
    return [...this.pts];
  }
}
