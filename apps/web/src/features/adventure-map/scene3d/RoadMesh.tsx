import { memo, useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, MeshStandardMaterial } from 'three';
import type { AdventureLayout, Pt } from '../adventure.types';
import { ISLAND_THEMES } from '../island/island-theme';

/** A strip along points with per-point heights (world units). */
function strip(points: readonly Pt[], ys: readonly number[], width: number, lift: number): BufferGeometry {
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(n - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const nz = (b.x - a.x) / len;
    const p = points[i]!;
    const y = ys[i]! + lift;
    pos.set([p.x + (nx * width) / 2, y, p.y + (nz * width) / 2, p.x - (nx * width) / 2, y, p.y - (nz * width) / 2], i * 6);
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    // Counter-clockwise seen from above (normals up).
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Side path from a branch stop to its challenge: a gentle curve. */
function sidePath(from: Pt, to: Pt, y0: number, y1: number): { pts: Pt[]; ys: number[] } {
  const mid = { x: (from.x + to.x) / 2 + (to.y - from.y) * 0.2, y: (from.y + to.y) / 2 - (to.x - from.x) * 0.2 };
  const pts: Pt[] = [];
  const ys: number[] = [];
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    pts.push({ x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mid.x + t * t * to.x, y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * mid.y + t * t * to.y });
    ys.push(y0 + (y1 - y0) * t);
  }
  return { pts, ys };
}

/** The dirt / stone road (with a darker edge) and the challenge side paths. */
export const RoadMesh = memo(function RoadMesh({ layout }: { layout: AdventureLayout }) {
  const theme = ISLAND_THEMES[layout.theme];
  const { road, edge, sides } = useMemo(() => {
    const sidePaths = layout.challenges.map((c) => {
      const from = layout.main[c.index]!;
      const s = sidePath(from.pos, c.pos, from.h, c.h);
      return strip(s.pts, s.ys, 0.62, 0.045);
    });
    return { road: strip(layout.route, layout.routeY, 1.0, 0.05), edge: strip(layout.route, layout.routeY, 1.3, 0.03), sides: sidePaths };
  }, [layout]);
  const materials = useMemo(
    () => ({
      road: new MeshStandardMaterial({ color: theme.road, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }),
      edge: new MeshStandardMaterial({ color: theme.roadEdge, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }),
    }),
    [theme],
  );
  useEffect(
    () => () => {
      road.dispose();
      edge.dispose();
      sides.forEach((g) => g.dispose());
    },
    [road, edge, sides],
  );
  useEffect(
    () => () => {
      materials.road.dispose();
      materials.edge.dispose();
    },
    [materials],
  );
  return (
    <>
      <mesh geometry={edge} material={materials.edge} receiveShadow />
      <mesh geometry={road} material={materials.road} receiveShadow />
      {sides.map((g, i) => (
        <mesh key={i} geometry={g} material={materials.road} receiveShadow />
      ))}
    </>
  );
});
