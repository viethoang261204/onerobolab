import type { Area2D } from '@robolab/shared';

/** Flat geometry for an Area2D, lying in the XY plane (rotate -90° about X to lay it on the floor). */
export function AreaGeometry({ area, inset = 0 }: { area: Area2D; inset?: number }) {
  return area.shape === 'circle' ? (
    <circleGeometry args={[Math.max(0.001, area.radius - inset), 48]} />
  ) : (
    <planeGeometry args={[Math.max(0.001, area.size.x - inset * 2), Math.max(0.001, area.size.z - inset * 2)]} />
  );
}

/** Rotation that lays a flat XY geometry on the floor and applies the area's yaw. */
export const floorRotation = (area: Area2D): [number, number, number] => [
  -Math.PI / 2,
  0,
  area.shape === 'rect' ? area.rotation : 0,
];
