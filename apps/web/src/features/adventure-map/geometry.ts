import type { Pt } from './adventure.types';

/* Small 2D helpers for the adventure map (map units = CSS px at zoom 1). */

/** Deterministic PRNG (mulberry32) — the map must look the same every visit. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Catmull-Rom through `pts`, sampled every ~`step` units. */
export function smooth(pts: readonly Pt[], step = 8): Pt[] {
  if (pts.length < 2) return [...pts];
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const n = Math.max(2, Math.ceil(dist(p1, p2) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Cumulative arc length at each point. */
export function arcLengths(line: readonly Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1]! + dist(line[i - 1]!, line[i]!));
  return out;
}

/** Index of the point closest to arc length `s`. */
export function indexAt(lengths: readonly number[], s: number): number {
  let lo = 0;
  let hi = lengths.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid]! < s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Unit tangent of the polyline at index `i`. */
export function tangent(line: readonly Pt[], i: number): Pt {
  const a = line[Math.max(0, i - 2)]!;
  const b = line[Math.min(line.length - 1, i + 2)]!;
  const d = dist(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/** Distance from `p` to the polyline (sampled points; lines are dense). */
export function distToLine(p: Pt, line: readonly Pt[], stride = 1): number {
  let best = Infinity;
  for (let i = 0; i < line.length; i += stride) {
    const d = dist(p, line[i]!);
    if (d < best) best = d;
  }
  return best;
}

/** Intersection points of two polylines. */
export function intersections(a: readonly Pt[], b: readonly Pt[]): { p: Pt; ia: number }[] {
  const out: { p: Pt; ia: number }[] = [];
  for (let i = 0; i < a.length - 1; i++) {
    const p = a[i]!;
    const r = { x: a[i + 1]!.x - p.x, y: a[i + 1]!.y - p.y };
    for (let j = 0; j < b.length - 1; j++) {
      const q = b[j]!;
      const s = { x: b[j + 1]!.x - q.x, y: b[j + 1]!.y - q.y };
      const den = r.x * s.y - r.y * s.x;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / den;
      const u = ((q.x - p.x) * r.y - (q.y - p.y) * r.x) / den;
      if (t >= 0 && t < 1 && u >= 0 && u < 1) out.push({ p: { x: p.x + t * r.x, y: p.y + t * r.y }, ia: i });
    }
  }
  return out;
}
