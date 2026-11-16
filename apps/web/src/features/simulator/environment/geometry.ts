import type { Vec2 } from '@robolab/shared';
import { BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry } from 'three';

/** Deterministic PRNG (mulberry32) so the world looks identical every load. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth periodic noise around a circle: organic outlines without seams. */
function outlineNoise(seed: number) {
  const rnd = seededRandom(seed);
  const waves = [2, 3, 5].map((freq) => ({ freq, phase: rnd() * Math.PI * 2, amp: 0.06 + rnd() * 0.05 }));
  return (angle: number) => 1 + waves.reduce((sum, w) => sum + Math.sin(angle * w.freq + w.phase) * w.amp, 0);
}

/** Flat island top (grass/dirt layer) with a wavy outline. Top face at y = 0. */
export function islandTopGeometry(radius: number, height: number, sides: number, seed: number): BufferGeometry {
  const geo = new CylinderGeometry(radius, radius * 0.94, height, sides, 1);
  const noise = outlineNoise(seed);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (Math.hypot(x, z) < 1e-4) continue;
    const k = noise(Math.atan2(z, x));
    pos.setXYZ(i, x * k, pos.getY(i), z * k);
  }
  geo.translate(0, -height / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Jagged inverted rock cone hanging under an island. Top face at y = 0. */
export function rockGeometry(radius: number, depth: number, sides: number, seed: number): BufferGeometry {
  const geo = new ConeGeometry(radius, depth, sides, 4);
  geo.rotateX(Math.PI);
  geo.translate(0, -depth / 2, 0);
  const noise = outlineNoise(seed);
  const rnd = seededRandom(seed * 7 + 3);
  const pos = geo.getAttribute('position');
  // Jitter per unique vertex position so seams stay closed.
  const offsets = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let o = offsets.get(key);
    if (!o) {
      const isTop = y > -1e-4;
      const isTip = Math.hypot(x, z) < 1e-4;
      const k = isTip ? 1 : noise(Math.atan2(z, x)) * (isTop ? 1 : 0.85 + rnd() * 0.3);
      o = [x * k, isTop ? 0 : y + (rnd() - 0.5) * depth * 0.12, z * k];
      offsets.set(key, o);
    }
    pos.setXYZ(i, o[0], o[1], o[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Flat ribbon along a polyline (for painted floor lines). Mitred joins keep
 * a constant width through curves. Lies in the XZ plane facing +Y.
 */
export function ribbonGeometry(points: readonly Vec2[], width: number, closed: boolean): BufferGeometry {
  const n = points.length;
  const half = width / 2;
  const positions = new Float32Array(n * 2 * 3);
  const dir = (a: Vec2, b: Vec2) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  };
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (!p) continue;
    const prev = closed || i > 0 ? points[(i - 1 + n) % n] : undefined;
    const next = closed || i < n - 1 ? points[(i + 1) % n] : undefined;
    const dIn = prev ? dir(prev, p) : undefined;
    const dOut = next ? dir(p, next) : undefined;
    const a = dIn ?? dOut ?? { x: 1, z: 0 };
    const b = dOut ?? dIn ?? { x: 1, z: 0 };
    // Averaged tangent → miter normal; scale so the ribbon keeps its width at joins.
    const tx = a.x + b.x;
    const tz = a.z + b.z;
    const tl = Math.hypot(tx, tz) || 1;
    const nx = -tz / tl;
    const nz = tx / tl;
    const miter = 1 / Math.max(0.5, nx * -a.z + nz * a.x);
    positions.set([p.x + nx * half * miter, 0, p.z + nz * half * miter], i * 6);
    positions.set([p.x - nx * half * miter, 0, p.z - nz * half * miter], i * 6 + 3);
  }
  const segs = closed ? n : n - 1;
  const index: number[] = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    // Winding depends on travel direction; the path material is double-sided.
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // UVs: u across the ribbon (0 → 1), v = metres travelled along it (for tiled textures).
  const uvs = new Float32Array(n * 2 * 2);
  let along = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const prev = points[i - 1];
    if (p && prev && i > 0) along += Math.hypot(p.x - prev.x, p.z - prev.z);
    uvs.set([0, along, 1, along], i * 4);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setAttribute('uv', new BufferAttribute(uvs, 2));
  geo.setIndex(index);
  const normals = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n * 2; i++) normals[i * 3 + 1] = 1;
  geo.setAttribute('normal', new BufferAttribute(normals, 3));
  geo.computeBoundingSphere();
  return geo;
}
