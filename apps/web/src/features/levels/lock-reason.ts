import { LevelRegistry } from '../../content/levels/registry';
import { WorldRegistry } from '../../content/worlds/registry';
import { messagesFor } from '../i18n/i18n';
import { levelsMessages } from './levels.messages';
import type { ProgressData, UnlockRequirement } from './progress';

/*
 * Why a mission is locked, in words a student understands:
 *   "Complete Sharp Turn to unlock this mission."
 * With server progress it comes from the API's unlock rules (only the
 * requirements not met yet); in local mode it's "finish the previous one".
 */

const m = () => messagesFor(levelsMessages);

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
      return m().reqLevelCompleted({ name: r.levelTitle ?? r.levelSlug ?? null });
    case 'LEVEL_STARS':
      return m().reqLevelStars({ stars: r.stars ?? 0, name: r.levelTitle ?? r.levelSlug ?? null });
    case 'WORLD_COMPLETED':
      return m().reqWorldCompleted({ name: r.worldName ?? null });
    case 'TOTAL_STARS':
      return m().reqTotalStars({ stars: r.stars ?? 0, have: stats?.stars ?? 0 });
    case 'TOTAL_XP':
      return m().reqTotalXp({ xp: r.xp ?? 0, have: stats?.xp ?? 0 });
    case 'ACHIEVEMENT':
      return m().reqAchievement({ name: r.achievementName ?? null });
  }
}

/** Sentence explaining why `levelId` is locked, or null when it isn't. */
export function lockMessage(levelId: string, progress: ProgressData): string | null {
  const state = progress.server?.states[levelId];
  if (progress.server) {
    if (!state || state.status !== 'locked') return null;
    if (state.lockReason === 'LOCKED_BY_ADMIN') return m().lockNotOpen;
    if (state.lockReason === 'ADMIN_OVERRIDE') return m().lockByTeacher;
    // The rule group closest to done decides the message (groups are alternatives).
    const options = state.unlock
      .map((g) => g.requirements.filter((r) => !met(r, progress)))
      .filter((unmet) => unmet.length > 0)
      .sort((a, b) => a.length - b.length);
    const best = options[0];
    if (!best) return m().lockSoon;
    return m().unlockSentence({ parts: best.map((r) => describe(r, progress)) });
  }
  // Local mode: missions unlock in order.
  const i = LevelRegistry.indexOf(levelId);
  const prev = i > 0 ? LevelRegistry.all[i - 1] : undefined;
  if (!prev || progress.levels[prev.id]?.completed || progress.levels[levelId]?.completed) return null;
  return m().lockPrevious({ title: prev.title });
}
