import { useMemo } from 'react';
import { useLevelStore } from '../../levels/level-store';
import type { ProgressData } from '../../levels/progress';
import { isWorldOpen, playerStats, summarizeWorlds } from '../../world-map/world-progress';
import type { UnlockContext } from '../model/unlocks';

/** What the student's journey has unlocked (derived from progress, never stored). */
export function unlockContext(progress: ProgressData, today = new Date()): UnlockContext {
  const worlds = summarizeWorlds(progress);
  return {
    openWorlds: new Set(worlds.filter((w) => isWorldOpen(w.status)).map((w) => w.world.order)),
    missionsCompleted: playerStats(progress, today).missionsCompleted,
    worldNames: new Map(worlds.map((w) => [w.world.order, w.world.name])),
  };
}

export function useUnlockContext(): UnlockContext {
  const progress = useLevelStore((s) => s.progress);
  return useMemo(() => unlockContext(progress), [progress]);
}
