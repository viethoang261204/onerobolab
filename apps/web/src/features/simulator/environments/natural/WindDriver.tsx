import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import type { MeshStandardMaterial } from 'three';
import type { Quality } from '../../../settings/settings-store';
import { useSettingsStore } from '../../../settings/settings-store';
import { envMaterial } from '../props/materials';
import { applyFoliageGloss, richNature, WIND } from './wind';

/**
 * Drives the shared wind (grass + tree crowns) and the leaf gloss for the
 * natural look: on with High quality, still and matte otherwise. One uniform
 * update per frame for the whole scene.
 */
export function WindDriver({ quality }: { quality: Quality }) {
  useEffect(() => {
    applyFoliageGloss(envMaterial('foliage') as MeshStandardMaterial, quality);
    return () => {
      WIND.strength.value = 0;
    };
  }, [quality]);
  useFrame((_, dt) => {
    const on = richNature(quality) && !useSettingsStore.getState().reduceMotion;
    WIND.strength.value = on ? 1 : 0;
    if (on) WIND.time.value += Math.min(dt, 0.1);
  });
  return null;
}
