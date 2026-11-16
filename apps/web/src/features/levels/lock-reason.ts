import { LevelRegistry } from '../../content/levels/registry';
import { WorldRegistry } from '../../content/worlds/registry';
import type { ProgressData, UnlockRequirement } from './progress';

/*
 * Why a mission is locked, in words a student understands:
 *   "Complete Sharp Turn to unlock this mission."
 * With server progress it comes from the API's unlock rules (only the
 * requirements not met yet); in local mode it's "finish the previous one".
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function met(r: UnlockRequirement, progress: ProgressData): boolean {
  const stats = progress.server?.stats;
  switch (r.type) {
    case 'LEVEL_COMPLETED':
      return !!r.levelSlug && !!progress.levels[r.levelSlug]?.completed;
    case 'LEVEL_STARS':
      return !!r.levelSlug && (progress.levels[r.levelSlug]?.bestStars ?? 0) >= (r.stars ?? 0);
    case 'WORLD_COMPLETED': {
      const world = WorldRegistry.all.find((w) => w.name === r.worldName);
      const levels = world ? LevelRegistry.byWorld(world.id) : [];
      return levels.length > 0 && levels.every((l) => progress.levels[l.id]?.completed);
    }
    case 'TOTAL_STARS':
      return (stats?.stars ?? 0) >= (r.stars ?? 0);
    case 'TOTAL_XP':
      return (stats?.xp ?? 0) >= (r.xp ?? 0);
    case 'ACHIEVEMENT':
      return false; // not known in the browser; the server decides
  }
}

function describe(r: UnlockRequirement, progress: ProgressData): string {
  const stats = progress.server?.stats;
  switch (r.type) {
    case 'LEVEL_COMPLETED':
      return `complete ${r.levelTitle ?? r.levelSlug ?? 'the previous mission'}`;
    case 'LEVEL_STARS':
      return `earn ${r.stars ?? 0} ★ on ${r.levelTitle ?? r.levelSlug ?? 'a mission'}`;
    case 'WORLD_COMPLETED':
      return `finish every mission in ${r.worldName ?? 'the previous world'}`;
    case 'TOTAL_STARS':
      return `collect ${r.stars ?? 0} stars (you have ${stats?.stars ?? 0})`;
    case 'TOTAL_XP':
      return `reach ${r.xp ?? 0} XP (you have ${stats?.xp ?? 0})`;
    case 'ACHIEVEMENT':
      return `earn the “${r.achievementName ?? 'special'}” achievement`;
  }
}

/** Sentence explaining why `levelId` is locked, or null when it isn't. */
export function lockMessage(levelId: string, progress: ProgressData): string | null {
  const state = progress.server?.states[levelId];
  if (progress.server) {
    if (!state || state.status !== 'locked') return null;
    if (state.lockReason === 'LOCKED_BY_ADMIN') return 'This mission isn’t open yet. Your teacher will unlock it.';
    if (state.lockReason === 'ADMIN_OVERRIDE') return 'Your teacher has locked this mission for now.';
    // The rule group closest to done decides the message (groups are alternatives).
    const options = state.unlock
      .map((g) => g.requirements.filter((r) => !met(r, progress)))
      .filter((unmet) => unmet.length > 0)
      .sort((a, b) => a.length - b.length);
    const best = options[0];
    if (!best) return 'Keep going — this mission unlocks soon.';
    return `${cap(best.map((r) => describe(r, progress)).join(' and '))} to unlock this mission.`;
  }
  // Local mode: missions unlock in order.
  const i = LevelRegistry.indexOf(levelId);
  const prev = i > 0 ? LevelRegistry.all[i - 1] : undefined;
  if (!prev || progress.levels[prev.id]?.completed || progress.levels[levelId]?.completed) return null;
  return `Complete ${prev.title} to unlock this mission.`;
}
