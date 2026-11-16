import { Environment, GradientTexture, Lightformer, SoftShadows } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { memo, useEffect } from 'react';
import { ACESFilmicToneMapping, AdditiveBlending, BackSide, NeutralToneMapping } from 'three';
import type { Quality } from '../../../settings/settings-store';
import { glowTexture } from '../../environment/textures';
import type { LightingProfile } from '../lighting';

const DOME = 90;
const SHADOW_MAP: Record<Quality, number> = { high: 2048, medium: 1024, low: 0 };

/** Gradient sky dome with a sun glow, per lighting profile. */
export const SkyDome = memo(function SkyDome({ profile }: { profile: LightingProfile }) {
  const [x, y, z] = profile.sun.direction;
  const len = Math.hypot(x, y, z) || 1;
  const k = (DOME * 0.9) / len;
  return (
    <>
      <color attach="background" args={[profile.sky.horizon]} />
      <fog attach="fog" args={[profile.fog.color, profile.fog.near, profile.fog.far]} />
      <mesh scale={DOME} renderOrder={-2}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial side={BackSide} depthWrite={false} fog={false}>
          <GradientTexture attach="map" stops={[0, 0.35, 0.5, 0.56, 1]} colors={[profile.sky.zenith, profile.sky.horizon, profile.sky.horizon, profile.sky.ground, profile.sky.ground]} />
        </meshBasicMaterial>
      </mesh>
      <sprite position={[x * k, Math.max(8, y * k), z * k]} scale={46} renderOrder={-1}>
        <spriteMaterial map={glowTexture()} color={profile.sunGlow} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} fog={false} />
      </sprite>
    </>
  );
});

/**
 * Key sun (the only shadow caster, frustum fitted to the course), sky/ground
 * fill, a cool rim light, and a tiny reflection map baked once from coloured
 * light panels (no HDR download) so metal and plastic read well.
 */
export const LightingRig = memo(function LightingRig({ profile, quality, extent, natural = false }: { profile: LightingProfile; quality: Quality; extent: number; natural?: boolean }) {
  const [x, y, z] = profile.sun.direction;
  const size = SHADOW_MAP[quality];
  const e = extent;
  return (
    <>
      <hemisphereLight args={[profile.hemi.sky, profile.hemi.ground, profile.hemi.intensity]} />
      <directionalLight
        key={quality}
        position={[x, y, z]}
        intensity={profile.sun.intensity}
        color={profile.sun.color}
        castShadow={size > 0}
        shadow-mapSize={[size || 512, size || 512]}
        shadow-camera-left={-e}
        shadow-camera-right={e}
        shadow-camera-top={e}
        shadow-camera-bottom={-e}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        // Natural look: smaller offsets so props stay grounded in their own shadow (no floating).
        shadow-bias={natural ? -0.00025 : -0.0004}
        shadow-normalBias={natural ? 0.008 : 0.02}
        shadow-radius={quality === 'high' ? 4 : 3}
      />
      <directionalLight position={[-x, y * 0.6, -z]} intensity={profile.rim.intensity} color={profile.rim.color} />
      {/* High + natural: contact-hardening soft shadows (PCSS) — sharp at the base, blurring with distance. */}
      {natural && quality === 'high' && <SoftShadows size={22} samples={12} focus={0.6} />}
      {natural ? (
        <SkyEnvironment profile={profile} />
      ) : (
        <Environment resolution={64} frames={1} environmentIntensity={0.55}>
          <Lightformer intensity={2.2} color={profile.studio.key} position={[x, y, z]} scale={[8, 8, 1]} />
          <Lightformer intensity={1.2} color={profile.studio.fill} position={[-x, 2, -z]} scale={[10, 4, 1]} />
          <Lightformer intensity={0.8} color={profile.studio.floor} position={[0, -6, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        </Environment>
      )}
    </>
  );
});

/**
 * Outdoor image-based lighting for the natural look: the reflection / ambient
 * map is rendered once from the profile's own sky (zenith → horizon → ground)
 * plus a bright sun disc, so every material is lit by the sky it stands under.
 */
const SkyEnvironment = memo(function SkyEnvironment({ profile }: { profile: LightingProfile }) {
  const [x, y, z] = profile.sun.direction;
  const len = Math.hypot(x, y, z) || 1;
  return (
    <Environment resolution={128} frames={1} environmentIntensity={0.85}>
      <mesh scale={40}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial side={BackSide}>
          <GradientTexture attach="map" stops={[0, 0.42, 0.5, 0.55, 1]} colors={[profile.sky.zenith, profile.sky.horizon, profile.sky.horizon, profile.studio.floor, profile.studio.floor]} />
        </meshBasicMaterial>
      </mesh>
      <Lightformer form="circle" intensity={9} color={profile.sun.color} position={[(x / len) * 30, (y / len) * 30, (z / len) * 30]} scale={5} />
    </Environment>
  );
});

/**
 * Tone mapping for the current look: filmic (ACES) for natural environments,
 * neutral for the stylised ones. Restores neutral when the scene unmounts.
 */
export function LookToneMapping({ natural }: { natural: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = natural ? ACESFilmicToneMapping : NeutralToneMapping;
    gl.toneMappingExposure = natural ? 1.08 : 1;
    return () => {
      gl.toneMapping = NeutralToneMapping;
      gl.toneMappingExposure = 1;
    };
  }, [gl, natural]);
  return null;
}
