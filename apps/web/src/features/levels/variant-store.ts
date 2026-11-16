import { useMemo } from 'react';
import { create } from 'zustand';
import { applyVariant, variantCount } from '../../content/levels/variants';
import type { LevelDefinition } from '../../content/levels/types';

/**
 * Which layout of the current level is on the table. Levels with variants
 * get a new random layout when they load and on every Reset (so programs
 * have to sense the world instead of memorising it); the simulator, the
 * minimap and the mission data panel all read the same index.
 */
interface VariantState {
  readonly levelId: string | null;
  readonly index: number;
}

export const useVariantStore = create<VariantState>()(() => ({ levelId: null, index: 0 }));

/** Choose a layout for `level` (a different one than now, when it has several). */
export function pickVariant(level: LevelDefinition, random: () => number = Math.random): void {
  const n = variantCount(level);
  const cur = useVariantStore.getState();
  let index = 0;
  if (n > 1) {
    index = Math.floor(random() * n) % n;
    if (cur.levelId === level.id && index === cur.index) index = (index + 1 + Math.floor(random() * (n - 1))) % n;
  }
  useVariantStore.setState({ levelId: level.id, index });
}

/** The index to play for `level` (0 until a layout was picked for it). */
export const variantIndexFor = (levelId: string): number => {
  const s = useVariantStore.getState();
  return s.levelId === levelId ? s.index : 0;
};

/** The level as currently played (its variant applied). */
export function useActiveLevel(level: LevelDefinition): LevelDefinition {
  const index = useVariantStore((s) => (s.levelId === level.id ? s.index : 0));
  return useMemo(() => applyVariant(level, index), [level, index]);
}
