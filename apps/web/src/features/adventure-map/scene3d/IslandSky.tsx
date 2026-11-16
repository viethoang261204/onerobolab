import { GradientTexture } from '@react-three/drei';
import { memo, useEffect, useMemo } from 'react';
import { BackSide, MeshStandardMaterial } from 'three';
import type { IslandTheme } from '../island/island-theme';
import { WATER_Y } from '../layout';

const SHADOW_SIZE = { high: 2048, medium: 1024, low: 0 } as const;

/**
 * Sky dome, fog, the sea around the island and the lights: soft sky fill plus
 * one sun — the only shadow caster, its frustum fitted to the island.
 */
export const IslandSky = memo(function IslandSky({ theme, quality }: { theme: IslandTheme; quality: keyof typeof SHADOW_SIZE }) {
  // Translucent surface over the sea floor: shallows near the coast read lighter.
  const sea = useMemo(
    () => ({
      surface: new MeshStandardMaterial({ color: theme.sea.shallow, transparent: true, opacity: 0.62, roughness: 0.18, metalness: 0.15, depthWrite: false }),
      deep: new MeshStandardMaterial({ color: theme.sea.deep, roughness: 0.9 }),
    }),
    [theme],
  );
  useEffect(
    () => () => {
      sea.surface.dispose();
      sea.deep.dispose();
    },
    [sea],
  );
  const shadows = SHADOW_SIZE[quality];
  return (
    <>
      <color attach="background" args={[theme.sky.fog]} />
      <fog attach="fog" args={[theme.sky.fog, 55, 120]} />
      <mesh scale={160} renderOrder={-2}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial side={BackSide} depthWrite={false} fog={false}>
          <GradientTexture attach="map" stops={[0, 0.42, 0.5, 1]} colors={[theme.sky.top, theme.sky.horizon, theme.sky.fog, theme.sky.fog]} />
        </meshBasicMaterial>
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-1.45} material={sea.deep}>
        <planeGeometry args={[240, 240, 1, 1]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={WATER_Y} material={sea.surface} renderOrder={1}>
        <planeGeometry args={[240, 240, 1, 1]} />
      </mesh>

      <hemisphereLight args={['#dbeafe', '#3b4a6b', 1.05]} />
      <directionalLight
        position={[14, 26, 16]}
        intensity={2.1}
        color="#fff4e2"
        castShadow={shadows > 0}
        shadow-mapSize={[shadows || 1, shadows || 1]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={80}
      />
      <directionalLight position={[-16, 10, -12]} intensity={0.45} color="#9db8ff" />
    </>
  );
});
