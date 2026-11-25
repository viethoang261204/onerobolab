import { LevelRegistry } from '../../content/levels/registry';
import type { LevelDefinition } from '../../content/levels/types';
import { WorldRegistry } from '../../content/worlds/registry';
import type { WorldDefinition } from '../../content/worlds/types';
import { ROBOT_OPTIONS } from '../../data/robots';
import { messagesFor, type Locale } from '../i18n/i18n';
import { lockMessage } from '../levels/lock-reason';
import { learningStreak, levelStatus, type LevelStatus, type ProgressData } from '../levels/progress';
import { worldMapMessages } from './world-map.messages';

/*
 * Everything the Home page and World Map show about progress is DERIVED here
 * from the UI 6 level progress (`ProgressData`) + level/world content. There
 * is no separate world progress state.
 */

export type WorldStatus = 'coming_soon' | 'locked' | 'available' | 'in_progress' | 'completed';

export interface WorldSummary {
  readonly world: WorldDefinition;
  readonly status: WorldStatus;
  readonly levels: readonly LevelDefinition[];
  readonly completed: number;
  readonly total: number;
  readonly stars: number;
  readonly maxStars: number;
  readonly xpTotal: number;
  /** 0–1. */
  readonly fraction: number;
  /** First unlocked, unfinished mission (or null). */
  readonly nextLevel: LevelDefinition | null;
  /** Why it can't be entered yet (null when open). */
  readonly lockedReason: string | null;
}

const order = () => LevelRegistry.all.map((l) => l.id);

export const statusOfLevel = (levelId: string, progress: ProgressData): LevelStatus => levelStatus(levelId, order(), progress);

export function summarizeWorld(world: WorldDefinition, progress: ProgressData): WorldSummary {
  const levels = LevelRegistry.byWorld(world.id);
  const statuses = levels.map((l) => statusOfLevel(l.id, progress));
  const completed = statuses.filter((s) => s === 'completed').length;
  const stars = levels.reduce((sum, l) => sum + (progress.levels[l.id]?.bestStars ?? 0), 0);
  const nextLevel = levels.find((_, i) => statuses[i] === 'available' || statuses[i] === 'in_progress') ?? null;

  let status: WorldStatus;
  if (levels.length === 0) status = 'coming_soon';
  else if (statuses[0] === 'locked') status = 'locked';
  else if (completed === levels.length) status = 'completed';
  else if (statuses.some((s) => s === 'completed' || s === 'in_progress')) status = 'in_progress';
  else status = 'available';

  const m = messagesFor(worldMapMessages);
  const previous = WorldRegistry.previous(world.id);
  // With the API, the first mission's unlock rules explain the world lock.
  const rawServerReason = status === 'locked' && progress.server && levels[0] ? lockMessage(levels[0].id, progress) : null;
  const serverReason = rawServerReason ? rawServerReason.replace(m.missionPhrase, m.worldPhrase).replace('this mission', m.worldPhrase) : null;
  const lockedReason =
    status === 'coming_soon'
      ? m.comingSoonReason
      : status === 'locked'
        ? (serverReason ?? m.lockedWorldReason({ prev: previous?.name ?? m.previousWorldFallback }))
        : null;

  return {
    world,
    status,
    levels,
    completed,
    total: levels.length,
    stars,
    maxStars: levels.length * 3,
    xpTotal: levels.reduce((sum, l) => sum + l.rewards.xp, 0),
    fraction: levels.length ? completed / levels.length : 0,
    nextLevel,
    lockedReason,
  };
}

export const summarizeWorlds = (progress: ProgressData): WorldSummary[] => WorldRegistry.all.map((w) => summarizeWorld(w, progress));

/** True when the world's missions can be opened. */
export const isWorldOpen = (s: WorldStatus) => s === 'available' || s === 'in_progress' || s === 'completed';

/** Short status label (never colour alone; locale-aware). */
export function worldStatusLabel(status: WorldStatus, locale?: Locale): string {
  const m = messagesFor(worldMapMessages, locale);
  switch (status) {
    case 'coming_soon':
      return m.worldStatusComingSoon;
    case 'locked':
      return m.worldStatusLocked;
    case 'available':
      return m.worldStatusAvailable;
    case 'in_progress':
      return m.worldStatusInProgress;
    case 'completed':
      return m.worldStatusCompleted;
  }
}

export function levelStatusLabel(status: LevelStatus, locale?: Locale): string {
  const m = messagesFor(worldMapMessages, locale);
  switch (status) {
    case 'locked':
      return m.levelStatusLocked;
    case 'available':
      return m.levelStatusAvailable;
    case 'in_progress':
      return m.levelStatusInProgress;
    case 'completed':
      return m.levelStatusCompleted;
  }
}

/** Short status label (never colour alone; English table kept for callers outside this area). */
export const WORLD_STATUS_LABEL: Record<WorldStatus, string> = {
  coming_soon: 'Coming soon',
  locked: 'Locked',
  available: 'Ready to start',
  in_progress: 'In progress',
  completed: 'Completed',
};

export const LEVEL_STATUS_LABEL: Record<LevelStatus, string> = {
  locked: 'Locked',
  available: 'Ready',
  in_progress: 'In progress',
  completed: 'Completed',
};

/** The world the student is currently on: the first open world that isn't finished (else the last open one). */
export function currentWorld(summaries: readonly WorldSummary[]): WorldSummary {
  const open = summaries.filter((s) => isWorldOpen(s.status));
  return open.find((s) => s.status !== 'completed') ?? open[open.length - 1] ?? (summaries[0] as WorldSummary);
}

export interface ContinueTarget {
  readonly level: LevelDefinition;
  readonly world: WorldSummary;
  /** No run has ever been made. */
  readonly fresh: boolean;
  /** Everything available is finished (the target is a replay). */
  readonly allDone: boolean;
}

/** What "Continue" should open: the last played level if unfinished, else the next open mission. */
export function continueTarget(progress: ProgressData): ContinueTarget {
  const summaries = summarizeWorlds(progress);
  const fresh = Object.values(progress.levels).every((p) => p.attempts === 0 && !p.completed);
  const last = progress.lastLevelId ? LevelRegistry.get(progress.lastLevelId) : undefined;
  const lastStatus = last ? statusOfLevel(last.id, progress) : 'locked';
  const next = LevelRegistry.all.find((l) => {
    const s = statusOfLevel(l.id, progress);
    return s === 'available' || s === 'in_progress';
  });
  const level = last && (lastStatus === 'available' || lastStatus === 'in_progress') ? last : (next ?? last ?? LevelRegistry.first());
  const world = summaries.find((s) => s.world.id === level.world) ?? (summaries[0] as WorldSummary);
  return { level, world, fresh, allDone: !next };
}

export const XP_PER_PLAYER_LEVEL = 250;

export interface PlayerStats {
  readonly xp: number;
  readonly level: number;
  /** 0–1 towards the next player level. */
  readonly xpProgress: number;
  readonly stars: number;
  readonly maxStars: number;
  readonly missionsCompleted: number;
  readonly missionsTotal: number;
  readonly robotsUnlocked: number;
  readonly robotsTotal: number;
  readonly streak: number;
}

export function playerStats(progress: ProgressData, today: Date): PlayerStats {
  let xp = 0;
  let stars = 0;
  let missionsCompleted = 0;
  for (const l of LevelRegistry.all) {
    const p = progress.levels[l.id];
    if (!p?.completed) continue;
    xp += l.rewards.xp;
    stars += p.bestStars;
    missionsCompleted++;
  }
  // Signed in: the server's totals (XP ledger incl. achievements and hints, stars ledger).
  const server = progress.server?.stats;
  if (server) {
    xp = server.xp;
    stars = server.stars;
    missionsCompleted = server.levelsCompleted;
  }
  return {
    xp,
    level: 1 + Math.floor(xp / XP_PER_PLAYER_LEVEL),
    xpProgress: (xp % XP_PER_PLAYER_LEVEL) / XP_PER_PLAYER_LEVEL,
    stars,
    maxStars: LevelRegistry.all.length * 3,
    missionsCompleted,
    missionsTotal: LevelRegistry.all.length,
    // Robots with a simulated model are the unlocked ones today.
    robotsUnlocked: ROBOT_OPTIONS.filter((r) => r.definitionId !== null).length,
    robotsTotal: ROBOT_OPTIONS.length,
    streak: server ? server.streak : learningStreak(progress.activeDays, today),
  };
}
