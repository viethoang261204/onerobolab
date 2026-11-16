import {
  LINE_SEARCH_RADIUS,
  OBSTACLE_DISTANCE,
  Vec2Math,
  type MapQuery,
  type Pose2D,
  type SensorColor,
  type SensorEngine,
  type SensorMount,
  type SensorReading,
  type SensorSnapshot,
  type SensorWorld,
  type Vec2,
} from '@robolab/shared';

/** Signed sideways offset (m, + = left of heading) to the nearest painted line, or null. */
export function lineOffset(map: MapQuery, point: Vec2, heading: number): number | null {
  const left = Vec2Math.headingToVector(heading + Math.PI / 2);
  let best: { dist: number; lateral: number } | null = null;
  for (const line of map.entitiesOfType('line')) {
    const n = line.points.length;
    const segs = line.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = line.points[i];
      const b = line.points[(i + 1) % n];
      if (!a || !b) continue;
      const ab = Vec2Math.sub(b, a);
      const len2 = Vec2Math.dot(ab, ab) || 1;
      const t = Math.max(0, Math.min(1, Vec2Math.dot(Vec2Math.sub(point, a), ab) / len2));
      const q = Vec2Math.add(a, Vec2Math.scale(ab, t));
      const dist = Vec2Math.distance(point, q);
      if (dist <= LINE_SEARCH_RADIUS && (!best || dist < best.dist)) best = { dist, lateral: Vec2Math.dot(Vec2Math.sub(q, point), left) };
    }
  }
  return best ? best.lateral : null;
}

/**
 * Sensor Engine: turns the robot pose + world into readings each tick.
 *   distance – ray against collision geometry (m, null when out of range)
 *   line     – floor surface under the sensor + signed offset to the line
 *   color    – floor colour under the sensor
 *   touch    – bumper volume overlapping a collider
 * Stateless per tick except for the cached last snapshot (convenience getters).
 */
export class SensorSuite implements SensorEngine {
  private mounts: readonly SensorMount[] = [];
  private last: SensorSnapshot = {};

  configure(mounts: readonly SensorMount[]): void {
    this.mounts = mounts;
    this.last = {};
  }

  sample(pose: Pose2D, world: SensorWorld): SensorSnapshot {
    const out: Record<string, SensorReading> = {};
    for (const m of this.mounts) {
      const p = Vec2Math.localToWorld(pose, { x: m.offset.x, z: m.offset.z });
      switch (m.kind) {
        case 'distance': {
          const dir = Vec2Math.headingToVector(pose.heading + m.yaw);
          const hit = world.physics.raycast({ x: p.x, y: m.offset.y, z: p.z }, { x: dir.x, y: 0, z: dir.z }, m.maxRange);
          out[m.id] = { kind: 'distance', distance: hit ? hit.distance : null };
          break;
        }
        case 'line': {
          const s = world.map.surfaceAt(p);
          out[m.id] = { kind: 'line', onLine: s.lineIntensity > 0.5, intensity: s.lineIntensity, offset: lineOffset(world.map, p, pose.heading) };
          break;
        }
        case 'color':
          out[m.id] = { kind: 'color', color: world.map.surfaceAt(p).color };
          break;
        case 'touch': {
          const hits = world.physics.overlapBox({ x: p.x, y: m.offset.y, z: p.z }, { x: m.size.x / 2, y: m.size.y / 2, z: m.size.z / 2 }, pose.heading);
          out[m.id] = { kind: 'touch', pressed: hits.length > 0 };
          break;
        }
      }
    }
    this.last = out;
    return out;
  }

  get snapshot(): SensorSnapshot {
    return this.last;
  }

  private first<K extends SensorReading['kind']>(kind: K): Extract<SensorReading, { kind: K }> | undefined {
    const m = this.mounts.find((s) => s.kind === kind);
    const r = m ? this.last[m.id] : undefined;
    return r?.kind === kind ? (r as Extract<SensorReading, { kind: K }>) : undefined;
  }

  /** Metres to the nearest obstacle ahead, or null when nothing is in range. */
  getDistance(): number | null {
    return this.first('distance')?.distance ?? null;
  }

  /** Something within OBSTACLE_DISTANCE ahead, or the bumper is pressed. */
  detectObstacle(): boolean {
    const d = this.getDistance();
    return (d !== null && d < OBSTACLE_DISTANCE) || !!this.first('touch')?.pressed;
  }

  detectLine(): boolean {
    return !!this.first('line')?.onLine;
  }

  getLineOffset(): number | null {
    return this.first('line')?.offset ?? null;
  }

  getColor(): SensorColor {
    return this.first('color')?.color ?? 'none';
  }

  isTouching(): boolean {
    return !!this.first('touch')?.pressed;
  }
}
