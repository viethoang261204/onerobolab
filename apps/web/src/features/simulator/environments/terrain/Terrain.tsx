import { memo, useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { groundDetailTexture } from '../natural/textures';
import type { TerrainField } from './fields';

/** Metres per repeat of the ground detail texture (natural look). */
const DETAIL_TILE = 0.75;

/** Grid lines per axis by quality — the mapping below keeps cells small near the course. */
const SEGMENTS = { low: 80, medium: 110, high: 140 } as const;

/**
 * Grid coordinate for t ∈ [-1, 1]: dense in the middle (≈0.1 m cells around
 * the course), coarse at the rim (≈1 m) — detail where the camera looks.
 */
const warp = (t: number, half: number) => half * (0.25 * t + 0.75 * t * t * t);

function buildTerrain(field: TerrainField, segments: number): BufferGeometry {
  const n = segments + 1;
  const half = field.size / 2;
  const pos = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  const c = new Color();
  const e = 0.05;
  for (let j = 0; j < n; j++) {
    const z = warp((j / segments) * 2 - 1, half);
    for (let i = 0; i < n; i++) {
      const x = warp((i / segments) * 2 - 1, half);
      const h = field.height(x, z);
      const gx = (field.height(x + e, z) - field.height(x - e, z)) / (2 * e);
      const gz = (field.height(x, z + e) - field.height(x, z - e)) / (2 * e);
      const slope = Math.min(1, Math.hypot(gx, gz));
      const k = (j * n + i) * 3;
      pos[k] = x;
      pos[k + 1] = h;
      pos[k + 2] = z;
      uv[(j * n + i) * 2] = x / DETAIL_TILE;
      uv[(j * n + i) * 2 + 1] = z / DETAIL_TILE;
      const [r, g, b] = field.color(x, z, h, slope);
      c.setRGB(r, g, b, SRGBColorSpace);
      col[k] = c.r;
      col[k + 1] = c.g;
      col[k + 2] = c.b;
    }
  }
  const index: number[] = [];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i;
      const b = a + 1;
      const d = a + n;
      const e2 = d + 1;
      index.push(a, d, b, b, d, e2);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

let material: MeshStandardMaterial | null = null;
const terrainMaterial = () => (material ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
/** Natural look: smooth shading + a tiled soil/grass detail texture over the palette colours. */
let naturalMaterial: MeshStandardMaterial | null = null;
const naturalTerrainMaterial = () => (naturalMaterial ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.97, map: groundDetailTexture(), envMapIntensity: 0.6 }));

/**
 * One vertex-coloured, flat-shaded mesh for the whole landscape (hills,
 * cliffs, gorges, river beds). Built once per level; disposed on unmount.
 */
export const Terrain = memo(function Terrain({ field, quality = 'medium', natural = false }: { field: TerrainField; quality?: keyof typeof SEGMENTS; natural?: boolean }) {
  const geometry = useMemo(() => buildTerrain(field, SEGMENTS[quality]), [field, quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Only High casts terrain shadows (cliff shade); Medium/Low skip the big mesh in the shadow pass.
  return <mesh geometry={geometry} material={natural ? naturalTerrainMaterial() : terrainMaterial()} receiveShadow castShadow={quality === 'high'} />;
});
