import type { MapQuery } from '@robolab/shared';
import { memo } from 'react';
import type { LevelDefinition } from '../../../content/levels/types';
import type { Quality } from '../../settings/settings-store';
import { getEnvironment } from './EnvironmentRegistry';
import { GameplayLayer } from './gameplay/GameplayLayer';
import { EmissivePulse } from './scene/Animated';
import { Atmosphere } from './scene/Atmosphere';
import { WindDriver } from './natural/WindDriver';
import { LightingRig, LookToneMapping, SkyDome } from './scene/SkyAndLights';

export interface EnvironmentSceneProps {
  level: LevelDefinition;
  map: MapQuery;
  quality: Quality;
  reduceMotion: boolean;
  /** Previews: no particles, no animation helpers. */
  preview?: boolean;
}

/**
 * The full 3D world for one level:
 *   sky + fog + lighting profile (per environment)
 *   the environment's own scene (terrain, roads, water, props, set pieces)
 *   the gameplay layer from the level map (walls, obstacles, checkpoints, goal)
 *   ambient particles.
 */
export const EnvironmentScene = memo(function EnvironmentScene({ level, map, quality, reduceMotion, preview = false }: EnvironmentSceneProps) {
  const env = getEnvironment(level.environmentId);
  const { info, Scene } = env;
  // Fog-of-war missions: thick fog, so only the robot's surroundings can be seen.
  const lighting = level.fog && !preview ? { ...env.lighting, fog: { ...env.lighting.fog, near: 2.6, far: 6.5 } } : env.lighting;
  const natural = info.look === 'natural';
  const extent = Math.max(level.map.size.x, level.map.size.z) / 2 + 1.6;
  const particles = lighting.particles;
  return (
    <>
      <LookToneMapping natural={natural} />
      {natural && <WindDriver quality={quality} />}
      <SkyDome profile={lighting} />
      <LightingRig profile={lighting} quality={quality} extent={extent} natural={natural} />
      <Scene level={level} map={map} quality={quality} reduceMotion={reduceMotion} />
      <GameplayLayer map={map} scene={level.scene} natural={natural} />
      {!preview && <EmissivePulse />}
      {!preview && particles && quality !== 'low' && (
        <Atmosphere kind={particles.kind} color={particles.color} count={Math.round(particles.count * (quality === 'high' ? 1 : 0.7))} half={extent + 1} animate={!reduceMotion} />
      )}
    </>
  );
});
