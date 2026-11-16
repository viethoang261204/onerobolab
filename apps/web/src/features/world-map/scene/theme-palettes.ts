import type { WorldTheme } from '../../../content/worlds/types';

/*
 * World theme colours — plain data with no three.js import, so 2D views
 * (Home cards, panels) can use them without pulling in the 3D bundle.
 */

/** Colour slots every theme defines (see `THEME_PALETTES`). */
export type PaletteSlot = 'top' | 'band' | 'rock' | 'a' | 'b' | 'c' | 'd' | 'glow';

export type ThemePalette = Readonly<Record<PaletteSlot, string>>;

/**
 * top/band/rock = island body; a–d = props; glow = emissive accent.
 * Kept close to the design tokens (cyan / violet / green / amber accents).
 */
export const THEME_PALETTES: Readonly<Record<WorldTheme, ThemePalette>> = {
  starter: { top: '#72cf5c', band: '#9a7652', rock: '#8e96ad', a: '#8a5a3b', b: '#43ad58', c: '#eef2f8', d: '#2a3142', glow: '#4ade80' },
  canyon: { top: '#e9a35f', band: '#c46a3a', rock: '#a4553a', a: '#d9783f', b: '#b95b2f', c: '#4f9a4a', d: '#7a4f33', glow: '#fb923c' },
  frost: { top: '#eef6ff', band: '#b9d5ef', rock: '#7f97b8', a: '#2f6f6a', b: '#ffffff', c: '#8fdcff', d: '#bfe8ff', glow: '#7dd3fc' },
  jungle: { top: '#3f9a4b', band: '#6b5a3c', rock: '#5f6b61', a: '#6b4a2f', b: '#2e8b47', c: '#9aa39a', d: '#5ec8f0', glow: '#34d399' },
  skylab: { top: '#d7deea', band: '#7d8aa6', rock: '#5a6480', a: '#eef2f8', b: '#2c3550', c: '#7cc4ff', d: '#1e3a8a', glow: '#a78bfa' },
  lava: { top: '#3d3643', band: '#2a232c', rock: '#241e26', a: '#554c5c', b: '#ff6a1a', c: '#4a4250', d: '#2f2833', glow: '#f87171' },
};

/** Slots rendered as emissive (lava, ice, lights) — dimmed when the world is locked. */
export const EMISSIVE_SLOTS: Readonly<Record<WorldTheme, readonly PaletteSlot[]>> = {
  starter: ['glow'],
  canyon: ['glow'],
  frost: ['c', 'glow'],
  jungle: ['d', 'glow'],
  skylab: ['c', 'glow'],
  lava: ['b', 'glow'],
};
