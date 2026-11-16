import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, DoubleSide, type Group, type Mesh, MeshStandardMaterial, ShaderMaterial } from 'three';
import { useSettingsStore } from '../../../settings/settings-store';
import { GEO } from '../../environment/shapes';
import { envMaterial } from '../props/materials';

/*
 * Small animated set pieces shared by environments. Each is one or two draw
 * calls and stops animating with reduced motion.
 */

const still = () => useSettingsStore.getState().reduceMotion;

/** Pulses the shared glow materials (warning lights blink in sync, energy breathes). */
export function EmissivePulse() {
  useFrame((state) => {
    if (still()) return;
    const t = state.clock.elapsedTime;
    (envMaterial('glowRed') as MeshStandardMaterial).emissiveIntensity = Math.sin(t * 4) > 0.2 ? 2.2 : 0.3;
    (envMaterial('glowAmber') as MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(t * 2.6) * 0.5;
    (envMaterial('glowCyan') as MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(t * 1.8) * 0.25;
  });
  return null;
}

const fieldVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const fieldFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float bands = 0.5 + 0.5 * sin(vUv.y * 40.0 - uTime * 4.0);
    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float a = (0.12 + bands * 0.22) * edge;
    gl_FragColor = vec4(uColor * (1.2 + bands), a);
  }
`;

/** Shimmering energy field filling a gate frame (width × height, facing along yaw). */
export const EnergyField = memo(function EnergyField({ x, z, yaw, width, height, color = '#22d3ee' }: { x: number; z: number; yaw: number; width: number; height: number; color?: string }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: fieldVertex,
        fragmentShader: fieldFragment,
        uniforms: { uTime: { value: 0 }, uColor: { value: new Color(color) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    if (!still()) material.uniforms.uTime!.value += Math.min(dt, 0.1);
  });
  return (
    <mesh position={[x, height / 2, z]} rotation-y={yaw + Math.PI / 2} material={material} renderOrder={3}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
});

const fallFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float s = fract(vUv.y * 3.0 + uTime * 1.6 + sin(vUv.x * 18.0) * 0.08);
    float streak = smoothstep(0.0, 0.25, s) * smoothstep(1.0, 0.6, s);
    vec3 col = mix(vec3(0.45, 0.8, 0.95), vec3(1.0), streak * 0.7);
    gl_FragColor = vec4(col, 0.72 + streak * 0.2);
  }
`;

/** Stylised waterfall sheet (vertical plane with falling streaks). */
export const Waterfall = memo(function Waterfall({ x, y, z, yaw, width, height }: { x: number; y: number; z: number; yaw: number; width: number; height: number }) {
  const material = useMemo(() => new ShaderMaterial({ vertexShader: fieldVertex, fragmentShader: fallFragment, uniforms: { uTime: { value: 0 } }, transparent: true, side: DoubleSide }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    if (!still()) material.uniforms.uTime!.value += Math.min(dt, 0.1);
  });
  return (
    <mesh position={[x, y + height / 2, z]} rotation-y={yaw} material={material}>
      <planeGeometry args={[width, height, 1, 1]} />
    </mesh>
  );
});

/** Rotating warning beacon (amber dome + sweeping light fin). */
export const WarningBeacon = memo(function WarningBeacon({ x, y, z, color = '#fbbf24' }: { x: number; y: number; z: number; color?: string }) {
  const fin = useRef<Group>(null);
  const mat = useMemo(() => new MeshStandardMaterial({ color, emissive: new Color(color), emissiveIntensity: 1.6, transparent: true, opacity: 0.55, depthWrite: false }), [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    if (fin.current && !still()) fin.current.rotation.y += dt * 4;
  });
  return (
    <group position={[x, y, z]}>
      <mesh geometry={GEO.cylinderFloor} material={envMaterial('metalDark')} scale={[0.07, 0.04, 0.07]} />
      <mesh geometry={GEO.sphere} material={mat} scale={[0.07, 0.07, 0.07]} position-y={0.06} />
      <group ref={fin} position-y={0.06}>
        <mesh geometry={GEO.box} material={mat} scale={[0.18, 0.01, 0.03]} position-x={0.09} />
      </group>
    </group>
  );
});

/** Conveyor belt with crates gliding along it (loops). */
export const Conveyor = memo(function Conveyor({ x, z, yaw, length }: { x: number; z: number; yaw: number; length: number }) {
  const crates = useRef<(Mesh | null)[]>([]);
  const t = useRef(0);
  const count = Math.max(2, Math.floor(length / 0.6));
  useFrame((_, dt) => {
    if (still()) return;
    t.current = (t.current + dt * 0.18) % 1;
    crates.current.forEach((m, i) => {
      if (!m) return;
      const u = ((i / count + t.current) % 1) - 0.5;
      m.position.x = u * length;
    });
  });
  return (
    <group position={[x, 0, z]} rotation-y={yaw}>
      <mesh geometry={GEO.boxFloor} material={envMaterial('metalDark')} scale={[length, 0.22, 0.32]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={envMaterial('concrete')} scale={[length, 0.012, 0.26]} position-y={0.225} />
      {Array.from({ length: Math.ceil(length / 0.5) + 1 }, (_, i) => (
        <mesh key={i} geometry={GEO.boxFloor} material={envMaterial('metal')} scale={[0.04, 0.22, 0.36]} position-x={-length / 2 + i * 0.5} />
      ))}
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(m) => void (crates.current[i] = m)} geometry={GEO.boxFloor} material={envMaterial('wood')} scale={0.16} position={[((i / count) - 0.5) * length, 0.23, 0]} castShadow />
      ))}
    </group>
  );
});
