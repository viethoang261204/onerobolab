import type { MeshStandardMaterial } from 'three';
import type { Quality } from '../../../settings/settings-store';

/*
 * One shared wind for the natural look. Shader uniforms are plain objects
 * shared by every material that sways (grass, tree crowns), so a single
 * `WindDriver` advances them all — no per-material work per frame.
 *
 * Wind and glossy foliage are High-quality extras; Medium and Low keep still
 * trees and matte leaves (cheaper, and the same look as before).
 */
export const WIND = {
  time: { value: 0 },
  /** 0 = still (Medium / Low / reduced motion), 1 = full sway. */
  strength: { value: 0 },
};

/** Is the High-only "living" layer on (grass, wind, glossy leaves)? */
export const richNature = (quality: Quality) => quality === 'high';

/**
 * Tree-crown sway for instanced leaf clusters: each cluster drifts as a whole
 * by a gust that depends on its world position and height (higher = more),
 * plus a small flutter of its own vertices. Amplitude is in metres
 * (divided by the instance scale so big and small clusters move alike).
 */
export function addCrownSway(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = WIND.time;
    shader.uniforms.uWindStrength = WIND.strength;
    shader.vertexShader = `uniform float uWindTime;\nuniform float uWindStrength;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 o = instanceMatrix[3].xyz;
        float k = uWindStrength * smoothstep(0.25, 1.4, o.y);
        if (k > 0.0) {
          float sc = max(length(instanceMatrix[0].xyz), 0.001);
          float g = sin(uWindTime * 1.3 + o.x * 0.8 + o.z * 0.6) + 0.45 * sin(uWindTime * 2.9 + o.x * 2.3 - o.z * 1.7);
          float flutter = sin(uWindTime * 6.0 + dot(position, vec3(9.0, 7.0, 11.0))) * 0.004;
          transformed += (vec3(g * 0.022, 0.0, g * 0.011) + flutter) * k / sc;
        }
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'onerobolab-crown-sway';
}

/** Leaf sheen on High (more sky reflection), matte otherwise. */
export function applyFoliageGloss(material: MeshStandardMaterial, quality: Quality) {
  const rich = richNature(quality);
  material.roughness = rich ? 0.62 : 0.85;
  material.envMapIntensity = rich ? 0.95 : 0.5;
}
