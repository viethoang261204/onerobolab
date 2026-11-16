import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { WorldTheme } from '../../../content/worlds/types';
import { EMISSIVE_SLOTS, THEME_PALETTES, type PaletteSlot } from './theme-palettes';

export type ThemeKit = Readonly<Record<PaletteSlot, MeshStandardMaterial>>;

/** Locked worlds: desaturated towards the "locked" slate blue and darkened. */
const LOCKED_TINT = new Color('#5d6b85');

const kits = new Map<string, ThemeKit>();

/**
 * Shared materials for one theme (+ locked variant). Created once and reused
 * by every island, the hero showcase and card previews; app-lifetime like
 * the environment `MAT` set, so never disposed per component.
 */
export function themeKit(theme: WorldTheme, locked: boolean): ThemeKit {
  const key = `${theme}:${locked ? 1 : 0}`;
  const hit = kits.get(key);
  if (hit) return hit;
  const palette = THEME_PALETTES[theme];
  const emissive = new Set(EMISSIVE_SLOTS[theme]);
  const kit = {} as Record<PaletteSlot, MeshStandardMaterial>;
  for (const slot of Object.keys(palette) as PaletteSlot[]) {
    const color = new Color(palette[slot]);
    if (locked) color.lerp(LOCKED_TINT, 0.62).multiplyScalar(0.72);
    const glows = emissive.has(slot);
    kit[slot] = new MeshStandardMaterial({
      color,
      roughness: glows ? 0.45 : 0.9,
      flatShading: !glows,
      ...(slot === 'd' && { side: DoubleSide }),
      ...(glows && { emissive: color.clone(), emissiveIntensity: locked ? 0.12 : 0.9 }),
    });
  }
  kits.set(key, kit);
  return kit;
}
