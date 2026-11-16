import type { Vec2 } from '@robolab/shared';
import { memo, useEffect, useMemo } from 'react';
import { DoubleSide, MeshStandardMaterial, type Texture } from 'three';
import { ribbonGeometry } from '../../environment/geometry';

export interface RoadStyle {
  /** Surface colour. */
  readonly surface: string;
  /** Kerb / edge band colour (drawn slightly wider underneath). */
  readonly edge: string;
  readonly roughness?: number;
  /** Optional surface texture (natural look), multiplied by `surface`; `tile` = metres per texture repeat. */
  readonly texture?: () => Texture;
  readonly tile?: number;
  /** Texture for the edge band (verge / kerb). */
  readonly edgeTexture?: () => Texture;
}

/** A per-road copy of a shared texture, tiled to the road's width (shares the image). */
function tiled(make: (() => Texture) | undefined, width: number, tile: number): Texture | null {
  if (!make) return null;
  const t = make().clone();
  t.repeat.set(width / tile, 1 / tile);
  t.needsUpdate = true;
  return t;
}

/**
 * Drivable road along the level path: an edge band with the surface on top
 * (two ribbons, both at floor level so the robot sits on them).
 */
export const Road = memo(function Road({ path, width, style, y = 0.003 }: { path: readonly Vec2[]; width: number; style: RoadStyle; y?: number }) {
  const { edge, surface, edgeMat, surfaceMat } = useMemo(
    () => ({
      edge: ribbonGeometry(path, width + 0.1, false),
      surface: ribbonGeometry(path, width, false),
      edgeMat: new MeshStandardMaterial({ color: style.edge, roughness: 0.95, side: DoubleSide, map: tiled(style.edgeTexture, width + 0.1, style.tile ?? 1) }),
      surfaceMat: new MeshStandardMaterial({ color: style.surface, roughness: style.roughness ?? 0.85, side: DoubleSide, map: tiled(style.texture, width, style.tile ?? 1) }),
    }),
    [path, width, style],
  );
  useEffect(
    () => () => {
      edge.dispose();
      surface.dispose();
      edgeMat.map?.dispose();
      surfaceMat.map?.dispose();
      edgeMat.dispose();
      surfaceMat.dispose();
    },
    [edge, surface, edgeMat, surfaceMat],
  );
  return (
    <>
      <mesh geometry={edge} material={edgeMat} position-y={y} receiveShadow />
      <mesh geometry={surface} material={surfaceMat} position-y={y + 0.0015} receiveShadow />
    </>
  );
});
