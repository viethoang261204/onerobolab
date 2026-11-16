import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo } from 'react';
import { Color, ShaderChunk, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';
import type { SceneWater } from '../../../../content/levels/types';
import type { Quality } from '../../../settings/settings-store';
import { useSettingsStore } from '../../../settings/settings-store';
import type { LightingProfile } from '../lighting';
import { subdivide } from '../terrain/Water';
import { richNature } from './wind';

const vertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vFlow;
  ${ShaderChunk.fog_pars_vertex}
  void main() {
    vFlow = uv; // x: across the channel (0 → 1), y: metres downstream
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    ${ShaderChunk.fog_vertex}
  }
`;

/*
 * Flowing creek: ripples and foam streaks are sampled in the channel's own
 * frame (across, downstream) and scroll downstream, so the water visibly runs
 * along the creek and around its bends. Schlick fresnel mixes the clear body
 * (showing the bed) with the sky; a sun glint follows the real sun. Foam
 * gathers at both banks. `uDetail` (High) adds a fine ripple layer and a
 * stronger, glossier glint.
 */
const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uWidth;
  uniform float uDetail;
  uniform vec3 uBody;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vWorld;
  varying vec2 vFlow;
  ${ShaderChunk.common}
  ${ShaderChunk.fog_pars_fragment}
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
  }
  // Ripple height in the channel frame: stretched along the flow, scrolling downstream.
  float ripple(vec2 c) {
    vec2 q = vec2(c.x * 7.0, (c.y - uTime * uSpeed) * 3.2);
    float h = vnoise(q) * 0.65 + vnoise(q * 2.1 + 3.7) * 0.35;
    if (uDetail > 0.5) h += (vnoise(vec2(c.x * 22.0, (c.y - uTime * uSpeed * 1.4) * 11.0)) - 0.5) * 0.35;
    return h;
  }
  void main() {
    vec2 c = vec2(vFlow.x * uWidth, vFlow.y);
    float e = 0.015;
    float h = ripple(c);
    vec3 n = normalize(vec3((h - ripple(c + vec2(e, 0.0))) * 0.8, 1.0, (h - ripple(c + vec2(0.0, e))) * 0.8));
    vec3 v = normalize(cameraPosition - vWorld);
    float cosT = clamp(dot(n, v), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(r.y * 1.6, 0.0, 1.0));
    vec3 body = uBody * (0.72 + 0.28 * h);
    vec3 col = mix(body, sky, clamp(fres * (1.1 + 0.25 * uDetail), 0.0, 1.0));
    // Foam: thin streaks carried downstream, thicker against both banks.
    float edge = min(vFlow.x, 1.0 - vFlow.x);
    float streak = smoothstep(0.78, 0.9, vnoise(vec2(c.x * 9.0, (c.y - uTime * uSpeed * 1.2) * 1.6)));
    float bank = smoothstep(0.16, 0.02, edge) * (0.55 + 0.45 * vnoise(vec2(c.y * 6.0 - uTime * uSpeed * 2.0, edge * 20.0)));
    float foam = clamp(streak * 0.35 + bank * 0.75, 0.0, 1.0);
    col = mix(col, vec3(0.93, 0.96, 0.97), foam * 0.7);
    float shine = mix(180.0, 420.0, uDetail);
    float spec = pow(max(dot(r, normalize(uSunDir)), 0.0), shine);
    col += uSunColor * spec * mix(2.0, 3.6, uDetail);
    float alpha = mix(0.74, 0.97, max(fres, foam));
    gl_FragColor = vec4(col, alpha);
    ${ShaderChunk.tonemapping_fragment}
    ${ShaderChunk.colorspace_fragment}
    ${ShaderChunk.fog_fragment}
  }
`;

/** Flowing creek water for the natural look (one draw call per channel). */
export const NaturalWater = memo(function NaturalWater({ water, profile, quality }: { water: readonly SceneWater[]; profile: LightingProfile; quality: Quality }) {
  const material = useMemo(() => {
    const [x, y, z] = profile.sun.direction;
    return new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uSpeed: { value: 0.32 },
          uWidth: { value: (water[0]?.width ?? 0.7) + 0.12 },
          uDetail: { value: 0 },
          uBody: { value: new Color('#3b5d4a') },
          uSkyTop: { value: new Color(profile.sky.zenith) },
          uSkyHorizon: { value: new Color(profile.sky.horizon) },
          uSunDir: { value: new Vector3(x, y, z).normalize() },
          uSunColor: { value: new Color(profile.sun.color) },
        },
      ]),
    });
  }, [profile, water]);
  const geometries = useMemo(() => water.map((w) => ({ geo: subdivide(w), y: -w.depth })), [water]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometries.forEach((g) => g.geo.dispose()), [geometries]);
  useEffect(() => {
    material.uniforms.uDetail!.value = richNature(quality) ? 1 : 0;
  }, [material, quality]);
  // The current keeps flowing on every quality (one uniform); reduced motion freezes it.
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
