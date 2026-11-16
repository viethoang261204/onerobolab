import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { beamTexture, hazardTexture } from './textures';

/**
 * Shared material system for the environment. One instance per look,
 * reused by every mesh (fewer shader programs, fewer state changes).
 * Lives for the app lifetime; never disposed per component.
 *
 *   primary : white concrete · light metal · dark road · green grass
 *   accent  : cyan · blue · purple · yellow · red
 *   emissive: checkpoints, energy cores, mission indicators, holograms (kept subtle)
 */
export const PALETTE = {
  concrete: '#eef1f6',
  concreteSide: '#c5ccda',
  metal: '#dfe4ee',
  metalDark: '#3d475d',
  road: '#1d2331',
  grass: '#7fcf5f',
  grassDark: '#63b84e',
  dirt: '#a07c57',
  rock: '#a2a8bf',
  trunk: '#8a5a3b',
  foliage: '#4cb35a',
  cyan: '#22d3ee',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  yellow: '#facc15',
  red: '#ef4444',
  orange: '#f59e0b',
  green: '#22c55e',
  cloud: '#ffffff',
} as const;

const std = (color: string, opts: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0] & object> = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });

const glow = (color: string, intensity = 1.1) =>
  new MeshStandardMaterial({ color, emissive: new Color(color), emissiveIntensity: intensity, roughness: 0.4, toneMapped: true });

export const MAT = {
  concrete: std(PALETTE.concrete, { roughness: 0.9 }),
  concreteSide: std(PALETTE.concreteSide, { roughness: 0.95 }),
  metal: std(PALETTE.metal, { roughness: 0.45, metalness: 0.25 }),
  metalDark: std(PALETTE.metalDark, { roughness: 0.5, metalness: 0.3 }),
  road: std(PALETTE.road, { roughness: 0.95, side: DoubleSide }),
  grass: std(PALETTE.grass, { roughness: 1, flatShading: true }),
  grassDark: std(PALETTE.grassDark, { roughness: 1, flatShading: true }),
  dirt: std(PALETTE.dirt, { roughness: 1, flatShading: true }),
  rock: std(PALETTE.rock, { roughness: 1, flatShading: true }),
  trunk: std(PALETTE.trunk, { roughness: 1, flatShading: true }),
  foliage: std('#ffffff', { roughness: 1, flatShading: true }), // tinted per instance
  glass: std('#1e3a5f', { roughness: 0.15, metalness: 0.4, emissive: new Color('#0e3a66'), emissiveIntensity: 0.35 }),
  hazard: std('#ffffff', { map: hazardTexture(), roughness: 0.7 }),
  red: std(PALETTE.red, { roughness: 0.6 }),
  orange: std(PALETTE.orange, { roughness: 0.65 }),
  yellow: std(PALETTE.yellow, { roughness: 0.6 }),
  white: std('#f8fafc', { roughness: 0.5 }),
  purple: std(PALETTE.purple, { roughness: 0.5 }),
  cloud: std(PALETTE.cloud, { roughness: 1, flatShading: true, emissive: new Color('#eaf3ff'), emissiveIntensity: 0.35 }),

  /** Pulsed by `EnergyPulse` — shared, so every energy core breathes in sync. */
  energy: glow(PALETTE.cyan, 1.4),
  cyanGlow: glow(PALETTE.cyan, 0.9),
  blueGlow: glow(PALETTE.blue, 0.8),
  purpleGlow: glow(PALETTE.purple, 0.9),
  redGlow: glow(PALETTE.red, 0.6),
  greenGlow: glow(PALETTE.green, 0.8),

  /** Soft vertical light beams (additive, no depth write). */
  beamCyan: new MeshBasicMaterial({
    color: PALETTE.cyan,
    map: beamTexture(),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  }),
  beamGreen: new MeshBasicMaterial({
    color: PALETTE.green,
    map: beamTexture(),
    transparent: true,
    opacity: 0.45,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  }),
} as const;

export type MaterialKey = keyof typeof MAT;
