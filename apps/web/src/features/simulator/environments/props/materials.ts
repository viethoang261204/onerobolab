import { Color, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three';
import { hazardTexture } from '../../environment/textures';
import { barkTexture, contactShadowTexture, foliageTexture, planksTexture } from '../natural/textures';
import { addCrownSway } from '../natural/wind';
import type { MatKey } from './batch';

const std = (color: string, o: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0] & object> = {}) => new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const glow = (color: string, intensity: number) => new MeshStandardMaterial({ color, emissive: new Color(color), emissiveIntensity: intensity, roughness: 0.4 });

const FACTORIES: Record<MatKey, () => Material> = {
  tint: () => std('#ffffff', { roughness: 0.75 }),
  tintFlat: () => std('#ffffff', { roughness: 0.95, flatShading: true }),
  tintMetal: () => std('#ffffff', { roughness: 0.42, metalness: 0.35 }),
  tintGlossy: () => std('#ffffff', { roughness: 0.3, metalness: 0.1 }),
  wood: () => std('#a7703f', { roughness: 0.9, flatShading: true }),
  woodDark: () => std('#6d4527', { roughness: 0.9 }),
  trunk: () => std('#7a4f33', { roughness: 1, flatShading: true }),
  rock: () => std('#9aa0b5', { roughness: 1, flatShading: true }),
  concrete: () => std('#d5dae3', { roughness: 0.92 }),
  metal: () => std('#dfe4ee', { roughness: 0.4, metalness: 0.4 }),
  metalDark: () => std('#3d475d', { roughness: 0.45, metalness: 0.45 }),
  glass: () => std('#1e3a5f', { roughness: 0.1, metalness: 0.5, emissive: new Color('#0e3a66'), emissiveIntensity: 0.45 }),
  ice: () => std('#bfe9ff', { roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.82, emissive: new Color('#6cc8ff'), emissiveIntensity: 0.18 }),
  hazard: () => std('#ffffff', { map: hazardTexture(), roughness: 0.7 }),
  glowCyan: () => glow('#22d3ee', 1.3),
  glowGreen: () => glow('#4ade80', 1.2),
  glowAmber: () => glow('#fbbf24', 1.3),
  glowRed: () => glow('#f43f5e', 1.6),
  glowWarm: () => glow('#ffe2a8', 1.6),
  glowPurple: () => glow('#a78bfa', 1.3),
  lava: () => glow('#ff6a1a', 1.8),
  foliage: () => {
    const m = std('#ffffff', { map: foliageTexture(), roughness: 0.85, envMapIntensity: 0.5 });
    addCrownSway(m); // still unless the wind is on (High quality)
    return m;
  },
  bark: () => std('#8a6a4e', { map: barkTexture(), roughness: 0.95 }),
  planks: () => std('#ffffff', { map: planksTexture(), roughness: 0.88 }),
  contact: () => new MeshBasicMaterial({ color: '#1b2414', map: contactShadowTexture(), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
};

const cache = new Map<MatKey, Material>();

/**
 * Shared environment material for a key — created on first use and kept for
 * the app lifetime (like the UI 2 `MAT` set), so every environment reuses the
 * same shader programs.
 */
export function envMaterial(key: MatKey): Material {
  let m = cache.get(key);
  if (!m) cache.set(key, (m = FACTORIES[key]()));
  return m;
}
