import { memo, useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { AdventureLayout } from '../adventure.types';
import type { IslandGround } from '../island/island-terrain';

/** Grid step by quality (world units). */
const STEP = { low: 0.42, medium: 0.32, high: 0.26 } as const;
/** Terrain extends past the island bounds so the coast drops into the sea. */
const MARGIN = 6;

function buildGeometry(layout: AdventureLayout, ground: IslandGround, step: number): BufferGeometry {
  const { bounds } = layout;
  const x0 = bounds.minX - MARGIN;
  const z0 = bounds.minZ - MARGIN;
  const nx = Math.ceil((bounds.maxX - bounds.minX + 2 * MARGIN) / step) + 1;
  const nz = Math.ceil((bounds.maxZ - bounds.minZ + 2 * MARGIN) / step) + 1;
  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = ground.height(x0 + i * step, z0 + j * step);

  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const c = new Color();
  const at = (i: number, j: number) => heights[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]!;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * step;
      const z = z0 + j * step;
      const h = at(i, j);
      const slope = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * step);
      const k = (j * nx + i) * 3;
      pos[k] = x;
      pos[k + 1] = h;
      pos[k + 2] = z;
      const [r, g, b] = ground.color(x, z, h, slope);
      c.setRGB(r, g, b, SRGBColorSpace);
      col[k] = c.r;
      col[k + 1] = c.g;
      col[k + 2] = c.b;
    }
  }
  const index = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let n = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const d = a + nx;
      index.set([a, d, a + 1, a + 1, d, d + 1], n);
      n += 6;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setIndex(new BufferAttribute(index, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

let material: MeshStandardMaterial | null = null;
const terrainMaterial = () => (material ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));

/** The island ground: one flat-shaded, vertex-coloured mesh (terraces, cliffs, gorge, coast). */
export const IslandTerrain = memo(function IslandTerrain({ layout, ground, quality }: { layout: AdventureLayout; ground: IslandGround; quality: keyof typeof STEP }) {
  const geometry = useMemo(() => buildGeometry(layout, ground, STEP[quality]), [layout, ground, quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={terrainMaterial()} receiveShadow castShadow={quality === 'high'} />;
});
