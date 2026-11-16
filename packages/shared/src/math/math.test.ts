import { describe, expect, it } from 'vitest';
import { angleDelta, clamp, degToRad, normalizeAngle } from './scalar';
import { distanceToSegment, headingToVector, isPointInArea, localToWorld, rotate } from './vec2';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('scalar math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('normalizes angles into (-π, π]', () => {
    close(normalizeAngle(3 * Math.PI), Math.PI);
    close(normalizeAngle(-Math.PI), Math.PI);
    close(normalizeAngle(degToRad(370)), degToRad(10));
    close(normalizeAngle(degToRad(-190)), degToRad(170));
  });

  it('computes the shortest signed angle delta', () => {
    close(angleDelta(degToRad(170), degToRad(-170)), degToRad(20));
    close(angleDelta(degToRad(-170), degToRad(170)), degToRad(-20));
  });
});

describe('vec2 math', () => {
  it('heading 0 faces +X and heading +90° faces -Z', () => {
    const f0 = headingToVector(0);
    close(f0.x, 1);
    close(f0.z, 0);
    const f90 = headingToVector(Math.PI / 2);
    close(f90.x, 0);
    close(f90.z, -1);
  });

  it('rotate agrees with headingToVector', () => {
    const r = rotate({ x: 1, z: 0 }, 1.234);
    const h = headingToVector(1.234);
    close(r.x, h.x);
    close(r.z, h.z);
  });

  it('maps robot-local offsets to world space', () => {
    // Robot at (2, 3) facing -Z: its right side (+Z local) points to +X world.
    const p = localToWorld({ x: 2, z: 3, heading: Math.PI / 2 }, { x: 0, z: 1 });
    close(p.x, 3);
    close(p.z, 3);
  });

  it('measures distance to a segment', () => {
    close(distanceToSegment({ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 1, z: 0 }), 1);
    close(distanceToSegment({ x: 3, z: 0 }, { x: -1, z: 0 }, { x: 1, z: 0 }), 2);
  });

  it('tests points against rotated rects and circles', () => {
    const rect = { shape: 'rect', center: { x: 0, z: 0 }, size: { x: 4, z: 1 }, rotation: Math.PI / 2 } as const;
    expect(isPointInArea(rect, { x: 0, z: 1.5 })).toBe(true);
    expect(isPointInArea(rect, { x: 1.5, z: 0 })).toBe(false);
    const circle = { shape: 'circle', center: { x: 1, z: 1 }, radius: 0.5 } as const;
    expect(isPointInArea(circle, { x: 1.3, z: 1.3 })).toBe(true);
    expect(isPointInArea(circle, { x: 1.5, z: 1.5 })).toBe(false);
  });
});
