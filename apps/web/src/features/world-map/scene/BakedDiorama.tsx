import { memo, useEffect, useMemo } from 'react';
import { BufferAttribute, type BufferGeometry, Color, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GEO } from '../../simulator/environment/shapes';
import { PropBatch } from '../../simulator/environments/props/batch';
import { BatchMesh } from '../../simulator/environments/props/BatchMesh';

/*
 * A static diorama baked into ONE vertex-coloured mesh (flat-coloured parts)
 * plus the few instanced groups that need their own material (glows, glass,
 * ice). Six islands × a couple of draw calls instead of a dozen each.
 */

const m = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const pos = new Vector3();
const scl = new Vector3();
const col = new Color();

function bake(batch: PropBatch): { mesh: BufferGeometry | null; rest: PropBatch } {
  const pieces: BufferGeometry[] = [];
  const rest = new PropBatch();
  for (const part of batch.parts) {
    if (part.material !== 'tintFlat') {
      for (const item of part.items) rest.add(part.geometry, part.material, item, part.shadow);
      continue;
    }
    const base = GEO[part.geometry].index ? GEO[part.geometry].toNonIndexed() : GEO[part.geometry].clone();
    base.deleteAttribute('uv');
    for (const item of part.items) {
      const g = base.clone();
      const r = item.r ?? 0;
      e.set(...(typeof r === 'number' ? ([0, r, 0] as const) : r));
      q.setFromEuler(e);
      pos.set(...item.p);
      const s = item.s ?? 1;
      if (typeof s === 'number') scl.setScalar(s);
      else scl.set(...s);
      g.applyMatrix4(m.compose(pos, q, scl));
      col.set(item.color ?? '#ffffff'); // sRGB hex → linear working colour
      const n = g.getAttribute('position').count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set([col.r, col.g, col.b], i * 3);
      g.setAttribute('color', new BufferAttribute(colors, 3));
      pieces.push(g);
    }
    base.dispose();
  }
  const mesh = pieces.length ? mergeGeometries(pieces, false) : null;
  pieces.forEach((p) => p.dispose());
  mesh?.computeBoundingSphere();
  return { mesh, rest };
}

let material: MeshStandardMaterial | null = null;
const bakedMaterial = () => (material ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));

export const BakedDiorama = memo(function BakedDiorama({ batch }: { batch: PropBatch }) {
  const baked = useMemo(() => bake(batch), [batch]);
  useEffect(() => () => baked.mesh?.dispose(), [baked]);
  return (
    <>
      {baked.mesh && <mesh geometry={baked.mesh} material={bakedMaterial()} />}
      <BatchMesh batch={baked.rest} shadows={false} />
    </>
  );
});

