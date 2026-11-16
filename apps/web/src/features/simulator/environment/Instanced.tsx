import { useLayoutEffect, useRef } from 'react';
import { Color, Euler, type BufferGeometry, type InstancedMesh, type Material, Matrix4, Quaternion, Vector3 } from 'three';

export type Triple = readonly [number, number, number];

export interface InstanceItem {
  readonly p: Triple;
  /** Yaw (number) or full Euler rotation. */
  readonly r?: number | Triple;
  /** Uniform or per-axis scale. */
  readonly s?: number | Triple;
  /** Per-instance colour (multiplies the material colour). */
  readonly color?: string;
}

interface InstancedProps {
  geometry: BufferGeometry;
  material: Material;
  items: readonly InstanceItem[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

const m = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const eul = new Euler();
const scl = new Vector3();
const col = new Color();

/**
 * One draw call for many copies of a shared geometry + material. The generic
 * building block for props (trees, rocks, cones, crates, barriers, planks…).
 */
export function Instanced({ geometry, material, items, castShadow = false, receiveShadow = false }: InstancedProps) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      pos.set(it.p[0], it.p[1], it.p[2]);
      if (typeof it.r === 'number' || it.r === undefined) eul.set(0, it.r ?? 0, 0);
      else eul.set(it.r[0], it.r[1], it.r[2]);
      quat.setFromEuler(eul);
      if (typeof it.s === 'number' || it.s === undefined) scl.setScalar(it.s ?? 1);
      else scl.set(it.s[0], it.s[1], it.s[2]);
      mesh.setMatrixAt(i, m.compose(pos, quat, scl));
      if (it.color) mesh.setColorAt(i, col.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  if (items.length === 0) return null;
  return (
    // `key` recreates the mesh when the count changes (fixed at construction).
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}
