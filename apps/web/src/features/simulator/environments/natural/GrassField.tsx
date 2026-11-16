import { memo, useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { Quality } from '../../../settings/settings-store';
import { WIND } from './wind';

/**
 * Grass clumps per quality (each clump = 3 blades × 3 triangles). Real grass
 * is a High-quality extra: Medium and Low show the textured lawn only.
 */
const CLUMPS: Record<Quality, number> = { low: 0, medium: 0, high: 2600 };

/**
 * One clump of three curved blades, 1 m tall in object space (instances scale
 * it to a few centimetres). Vertex colour runs dark at the root to light at
 * the tip; normals point up so blades are lit like the lawn they stand on.
 */
function clumpGeometry(): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  // Root close to the lawn colour (blades grow out of it), tip only a little lighter.
  const root = [0.62, 0.66, 0.52];
  const tip = [0.96, 0.98, 0.84];
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI * 2 + 0.4;
    const ox = Math.cos(a) * 0.12;
    const oz = Math.sin(a) * 0.12;
    const lean = 0.18 + b * 0.06;
    const dx = Math.cos(a + 1.2);
    const dz = Math.sin(a + 1.2);
    const w = 0.045;
    const base = pos.length / 3;
    // root pair, middle pair, tip
    const pts: [number, number, number, number][] = [
      [-w, 0, 0, 0],
      [w, 0, 0, 0],
      [-w * 0.6, 0.55, lean * 0.35, 0.55],
      [w * 0.6, 0.55, lean * 0.35, 0.55],
      [0, 1, lean, 1],
    ];
    for (const [side, y, fwd, t] of pts) {
      pos.push(ox + -dz * side + Math.cos(a) * fwd, y, oz + dx * side + Math.sin(a) * fwd);
      col.push(root[0]! + (tip[0]! - root[0]!) * t, root[1]! + (tip[1]! - root[1]!) * t, root[2]! + (tip[2]! - root[2]!) * t);
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Wind: blades sway with height², phase from the clump's world position. */
function windMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide, envMapIntensity: 0.4 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = WIND.time;
    shader.uniforms.uWindStrength = WIND.strength;
    shader.vertexShader = `uniform float uTime;\nuniform float uWindStrength;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 rootW = instanceMatrix[3].xyz;
        float h = position.y * position.y;
        float gust = sin(uTime * 1.7 + rootW.x * 2.1 + rootW.z * 1.3) + 0.5 * sin(uTime * 3.1 + rootW.x * 5.0);
        transformed.x += gust * 0.08 * h * uWindStrength;
        transformed.z += gust * 0.04 * h * uWindStrength;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'onerobolab-grass-wind';
  return material;
}

/** Smooth value noise in [0, 1] — grass grows in patches, not as an even carpet. */
function patchNoise(x: number, z: number, seed: number): number {
  const h = (i: number, j: number) => {
    const v = Math.sin(i * 127.1 + j * 311.7 + seed * 17.3) * 43758.5453;
    return v - Math.floor(v);
  };
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = h(xi, zi) + (h(xi + 1, zi) - h(xi, zi)) * ux;
  const b = h(xi, zi + 1) + (h(xi + 1, zi + 1) - h(xi, zi + 1)) * ux;
  return a + (b - a) * uz;
}

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface GrassFieldProps {
  /** Half extents (m) of the grass area, centred on the origin. */
  readonly half: { readonly x: number; readonly z: number };
  /** Where grass may grow (off roads, water, walls…). */
  readonly allow: (x: number, z: number) => boolean;
  /** Ground height under a point. */
  readonly ground?: (x: number, z: number) => number;
  /** Blade colours (each clump picks one; the vertex gradient shades it). */
  readonly palette: readonly string[];
  readonly quality: Quality;
  readonly seed?: number;
  /** Blade height range (m). */
  readonly height?: readonly [number, number];
}

/**
 * Patches of individual grass blades around the course (High quality only) —
 * one instanced draw call, no shadow casting (it receives the sun's shadow).
 * Sways with the shared wind (`WindDriver`), still with reduced motion.
 */
export const GrassField = memo(function GrassField({ half, allow, ground, palette, quality, seed = 7, height = [0.022, 0.042] }: GrassFieldProps) {
  const count = CLUMPS[quality];
  const built = useMemo(() => {
    if (count === 0) return null;
    const geometry = clumpGeometry();
    const material = windMaterial();
    const mesh = new InstancedMesh(geometry, material, count);
    const rnd = prng(seed);
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const p = new Vector3();
    const s = new Vector3();
    const c = new Color();
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 14; tries++) {
      const x = (rnd() * 2 - 1) * half.x;
      const z = (rnd() * 2 - 1) * half.z;
      if (!allow(x, z)) continue;
      // Patches: dense where the noise is high, a light sprinkle elsewhere.
      if (rnd() > (patchNoise(x * 1.4, z * 1.4, seed) > 0.55 ? 1 : 0.12)) continue;
      const hgt = height[0] + rnd() * (height[1] - height[0]);
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      p.set(x, (ground ? ground(x, z) : 0) - 0.002, z);
      s.set(hgt * (0.8 + rnd() * 0.5), hgt, hgt * (0.8 + rnd() * 0.5));
      mesh.setMatrixAt(placed, m.compose(p, q, s));
      c.set(palette[Math.floor(rnd() * palette.length)]!);
      c.multiplyScalar(0.85 + rnd() * 0.3);
      mesh.setColorAt(placed, c);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    return { mesh, geometry, material };
  }, [count, half.x, half.z, allow, ground, palette, seed, height]);

  useEffect(
    () => () => {
      built?.geometry.dispose();
      built?.material.dispose();
      built?.mesh.dispose();
    },
    [built],
  );

  return built ? <primitive object={built.mesh} /> : null;
});
