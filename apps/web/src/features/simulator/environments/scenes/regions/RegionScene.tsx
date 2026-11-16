import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { BatchMesh } from '../../props/BatchMesh';
import { layeredColor, type TerrainField } from '../../terrain/fields';
import { Road } from '../../terrain/Road';
import { Terrain } from '../../terrain/Terrain';
import { Water } from '../../terrain/Water';
import type { EnvironmentProps } from '../../types';
import { landscape, TERRAIN_SIZE } from '../common';
import { LANDMARKS, type RegionEnvironmentId } from './landmarks';
import { buildRegionProps } from './region-props';
import { REGIONS } from './regions';

/**
 * Scene component for one Starter Island mission environment: its region's
 * terrain, road and scenery around the level's own layout, plus the
 * mission's landmark. One component per environment id (see
 * `EnvironmentRegistry`), all built from the same region system.
 */
export function regionScene(envId: RegionEnvironmentId): ComponentType<EnvironmentProps> {
  const preset = REGIONS[LANDMARKS[envId].region];
  const seed = [...envId].reduce((h, ch) => (h * 17 + ch.charCodeAt(0)) % 997, 3);
  function RegionScene({ level, quality }: EnvironmentProps) {
    const height = useMemo(() => landscape(level, { flat: preset.flat, hills: preset.hills, horizon: preset.horizon, seed }), [level]);
    const field = useMemo<TerrainField>(() => ({ height, color: layeredColor(preset.palette, seed % 31), size: TERRAIN_SIZE }), [height]);
    const batch = useMemo(() => buildRegionProps(level, envId, quality, height), [level, quality, height]);
    return (
      <>
        <Terrain field={field} quality={quality} />
        <Road path={level.scene.path} width={level.scene.pathWidth} style={preset.road} />
        <Water water={level.scene.water ?? []} />
        <BatchMesh batch={batch} />
      </>
    );
  }
  RegionScene.displayName = `RegionScene(${envId})`;
  return RegionScene;
}
