import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo } from 'react';
import { Color, ShaderChunk, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import type { SceneWater } from '../../../../content/levels/types';
import { useSettingsStore } from '../../../settings/settings-store';
import { ribbonGeometry } from '../../environment/geometry';

const vertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  ${ShaderChunk.fog_pars_vertex}
  void main() {
    vec3 p = position;
    p.y += sin(p.x * 3.1 + uTime * 1.4) * 0.008 + cos(p.z * 2.7 - uTime * 1.1) * 0.008;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    ${ShaderChunk.fog_vertex}
  }
`;

// Stylised water: deep/shallow tint, drifting ripple bands, sparkle glints, fresnel lift.
const fragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec2 uFlow;
  varying vec3 vWorld;
  ${ShaderChunk.fog_pars_fragment}
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 uv = vWorld.xz * 2.2 + uFlow * uTime;
    float n = noise(uv) * 0.6 + noise(uv * 2.3 - uFlow * uTime * 0.7) * 0.4;
    float bands = smoothstep(0.62, 0.7, n) - smoothstep(0.72, 0.8, n);
    float glint = step(0.93, noise(vWorld.xz * 9.0 + uTime * 0.6));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 2.0);
    vec3 col = mix(uDeep, uShallow, n * 0.6 + 0.2);
    col += uFoam * (bands * 0.35 + glint * 0.5);
    col = mix(col, uShallow * 1.25, fres * 0.5);
    gl_FragColor = vec4(col, 0.9);
    ${ShaderChunk.fog_fragment}
  }
`;

export interface WaterStyle {
  readonly deep: string;
  readonly shallow: string;
  readonly foam?: string;
}

const STYLE: WaterStyle = { deep: '#1d6fa3', shallow: '#4fc3e8', foam: '#ffffff' };

/** The stylised water shader material (caller disposes; advance `uniforms.uTime`). */
export function createWaterMaterial(style: WaterStyle = STYLE): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new Color(style.deep) },
        uShallow: { value: new Color(style.shallow) },
        uFoam: { value: new Color(style.foam ?? '#ffffff') },
        uFlow: { value: [0.35, 0.12] },
      },
    ]),
  });
}

/** Animated stylised water ribbon along each channel (one draw call per channel). */
export const Water = memo(function Water({ water, style = STYLE }: { water: readonly SceneWater[]; style?: WaterStyle }) {
  const material = useMemo(() => createWaterMaterial(style), [style]);
  const geometries = useMemo(() => water.map((w) => ({ geo: subdivide(w), y: -w.depth })), [water]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometries.forEach((g) => g.geo.dispose()), [geometries]);
  useFrame((_, dt) => {
    if (!useSettingsStore.getState().reduceMotion) material.uniforms.uTime!.value += Math.min(dt, 0.1);
  });
  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g.geo} material={material} position-y={g.y} renderOrder={1} />
      ))}
    </>
  );
});

/** Ribbon with extra points along long segments so the waves have vertices to move. */
export function subdivide(w: SceneWater) {
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i + 1 < w.points.length; i++) {
    const a = w.points[i]!;
    const b = w.points[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.15));
    for (let k = 0; k < n; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  pts.push(w.points[w.points.length - 1]!);
  return ribbonGeometry(pts, w.width + 0.12, false);
}
