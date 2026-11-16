import type { Area2D, Pose2D, Vec2 } from '../types/geometry';

export const vec2 = (x: number, z: number): Vec2 => ({ x, z });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });

export const scale = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, z: v.z * s });

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;

export const length = (v: Vec2): number => Math.hypot(v.x, v.z);

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Rotate a ground-plane vector by `angle` about +Y (counter-clockwise from
 * above, so +X rotates toward -Z).
 */
export const rotate = (v: Vec2, angle: number): Vec2 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c + v.z * s, z: -v.x * s + v.z * c };
};

/** Unit vector the robot faces at `heading`. */
export const headingToVector = (heading: number): Vec2 => ({
  x: Math.cos(heading),
  z: -Math.sin(heading),
});

/** Transform a robot-local point (+X forward, +Z right) to world space. */
export const localToWorld = (pose: Pose2D, local: Vec2): Vec2 =>
  add({ x: pose.x, z: pose.z }, rotate(local, pose.heading));

export const distanceToSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  if (lenSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / lenSq));
  return distance(p, add(a, scale(ab, t)));
};

export const isPointInArea = (area: Area2D, p: Vec2): boolean => {
  if (area.shape === 'circle') return distance(p, area.center) <= area.radius;
  const local = rotate(sub(p, area.center), -area.rotation);
  return Math.abs(local.x) <= area.size.x / 2 && Math.abs(local.z) <= area.size.z / 2;
};
