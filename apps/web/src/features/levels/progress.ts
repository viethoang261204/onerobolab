import { migrateLevelId } from '../../content/levels/registry';
import { browserStorage, readJson, type KeyValueStorage } from '../persistence/storage';

export type LevelStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface LevelProgress {
  readonly completed: boolean;
  /** 0–3. */
  readonly bestStars: number;
  /** Best completion time (s), null until completed. */
  readonly bestTime: number | null;
  readonly attempts: number;
  readonly completedAt: string | null;
}

/** A prerequisite as the API describes it (names included), for "Complete X to unlock" messages. */
export interface UnlockRequirement {
  readonly type: 'LEVEL_COMPLETED' | 'LEVEL_STARS' | 'WORLD_COMPLETED' | 'TOTAL_STARS' | 'TOTAL_XP' | 'ACHIEVEMENT';
  readonly levelSlug?: string;
  readonly levelTitle?: string;
  readonly worldName?: string;
  readonly achievementName?: string;
  readonly stars?: number;
  readonly xp?: number;
}

/** What the server decided (Student Phase 4): level states and totals are never computed in the browser. */
export interface ServerProgress {
  readonly states: Readonly<
    Record<
      string,
      {
        readonly status: LevelStatus;
        /** API reason code for locked levels (PREREQUISITES_NOT_MET, LOCKED_BY_ADMIN, ADMIN_OVERRIDE…). */
        readonly lockReason: string | null;
        /** Rule groups (OR) of requirements (AND) that unlock a locked level. */
        readonly unlock: readonly { readonly requirements: readonly UnlockRequirement[] }[];
      }
    >
  >;
  readonly stats: { readonly xp: number; readonly stars: number; readonly levelsCompleted: number; readonly streak: number };
}

export interface ProgressData {
  readonly version: 1;
  readonly levels: Readonly<Record<string, LevelProgress>>;
  readonly lastLevelId: string | null;
  /** Local calendar days (YYYY-MM-DD) with any activity, newest last, capped. Drives the learning streak. */
  readonly activeDays?: readonly string[];
  /** Present when progress comes from the API: then it is authoritative for states and totals. */
  readonly server?: ServerProgress;
}

/**
 * Student progress. Local today; a backend implementation can replace it
 * behind this interface (same methods, async-friendly data shape).
 */
export interface ProgressStore {
  getProgress(): ProgressData;
  /** A run started on this level. */
  recordAttempt(levelId: string): ProgressData;
  /** Level finished — keeps the best stars / time (never lowers them). */
  setLevelComplete(levelId: string, result: { stars: number; time: number }): ProgressData;
  setBestScore(levelId: string, time: number): ProgressData;
  setStars(levelId: string, stars: number): ProgressData;
  getLastLevel(): string | null;
  setLastLevel(levelId: string): ProgressData;
  resetProgress(): ProgressData;
}

const KEY = 'roboverse.progress.v1';
const EMPTY: ProgressData = { version: 1, levels: {}, lastLevelId: null };
const EMPTY_LEVEL: LevelProgress = { completed: false, bestStars: 0, bestTime: null, attempts: 0, completedAt: null };

const isProgress = (v: unknown): v is ProgressData =>
  typeof v === 'object' && v !== null && (v as ProgressData).version === 1 && typeof (v as ProgressData).levels === 'object';

const MAX_ACTIVE_DAYS = 60;

/** Local calendar day, YYYY-MM-DD. */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Rename legacy level ids (UI 6 "cs1-01" → "starter-01"). */
export function migrateProgress(data: ProgressData): ProgressData {
  const levels: Record<string, LevelProgress> = {};
  for (const [id, p] of Object.entries(data.levels)) levels[migrateLevelId(id)] = p;
  return { ...data, levels, lastLevelId: data.lastLevelId && migrateLevelId(data.lastLevelId) };
}

/**
 * Consecutive active days ending today (or yesterday — the streak survives
 * until the end of a missed day).
 */
export function learningStreak(activeDays: readonly string[] | undefined, today: Date): number {
  if (!activeDays?.length) return 0;
  const days = new Set(activeDays);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export class LocalProgressStore implements ProgressStore {
  private data: ProgressData;

  constructor(
    private readonly storage: KeyValueStorage = browserStorage(),
    /** Clock for activity days (injectable for tests). */
    private readonly now: () => Date = () => new Date(),
  ) {
    this.data = migrateProgress(readJson(storage, KEY, EMPTY, isProgress));
  }

  private update(levelId: string | null, fn: (p: LevelProgress) => LevelProgress, lastLevelId = this.data.lastLevelId, active = false): ProgressData {
    const levels = levelId ? { ...this.data.levels, [levelId]: fn(this.data.levels[levelId] ?? EMPTY_LEVEL) } : this.data.levels;
    let activeDays = this.data.activeDays ?? [];
    const today = dayKey(this.now());
    if (active && activeDays[activeDays.length - 1] !== today) activeDays = [...activeDays, today].slice(-MAX_ACTIVE_DAYS);
    this.data = { version: 1, levels, lastLevelId, activeDays };
    this.storage.setItem(KEY, JSON.stringify(this.data));
    return this.data;
  }

  getProgress(): ProgressData {
    return this.data;
  }

  recordAttempt(levelId: string): ProgressData {
    return this.update(levelId, (p) => ({ ...p, attempts: p.attempts + 1 }), this.data.lastLevelId, true);
  }

  setLevelComplete(levelId: string, result: { stars: number; time: number }): ProgressData {
    return this.update(levelId, (p) => ({
      ...p,
      completed: true,
      bestStars: Math.max(p.bestStars, result.stars),
      bestTime: p.bestTime === null ? result.time : Math.min(p.bestTime, result.time),
      completedAt: p.completedAt ?? this.now().toISOString(),
    }), this.data.lastLevelId, true);
  }

  setBestScore(levelId: string, time: number): ProgressData {
    return this.update(levelId, (p) => ({ ...p, bestTime: p.bestTime === null ? time : Math.min(p.bestTime, time) }));
  }

  setStars(levelId: string, stars: number): ProgressData {
    return this.update(levelId, (p) => ({ ...p, bestStars: Math.max(p.bestStars, Math.min(3, Math.max(0, stars))) }));
  }

  getLastLevel(): string | null {
    return this.data.lastLevelId;
  }

  setLastLevel(levelId: string): ProgressData {
    return this.update(null, (p) => p, levelId);
  }

  resetProgress(): ProgressData {
    this.data = EMPTY;
    this.storage.removeItem(KEY);
    return this.data;
  }
}

/**
 * A level's status. With server progress, it's the API's decision (unknown
 * levels are locked). Offline / local mode: the first level is open and each
 * level unlocks when the previous one is completed.
 */
export function levelStatus(levelId: string, order: readonly string[], progress: ProgressData): LevelStatus {
  if (progress.server) return progress.server.states[levelId]?.status ?? 'locked';
  const p = progress.levels[levelId];
  if (p?.completed) return 'completed';
  const i = order.indexOf(levelId);
  const unlocked = i <= 0 || !!progress.levels[order[i - 1] ?? '']?.completed;
  if (!unlocked) return 'locked';
  return p && p.attempts > 0 ? 'in_progress' : 'available';
}

/**
 * Progress from the OneRoboLab API. The catalog request fills it; runs update
 * it optimistically in the browser and the next catalog refresh replaces it
 * with the server's numbers. Nothing here decides unlocks, stars or XP.
 */
export class ServerProgressStore implements ProgressStore {
  constructor(private data: ProgressData) {}

  /** Replace everything with a fresh server answer. */
  replace(data: ProgressData): ProgressData {
    this.data = data;
    return data;
  }

  private patch(levelId: string, fn: (p: LevelProgress) => LevelProgress, lastLevelId = this.data.lastLevelId): ProgressData {
    const levels = { ...this.data.levels, [levelId]: fn(this.data.levels[levelId] ?? EMPTY_LEVEL) };
    this.data = { ...this.data, levels, lastLevelId };
    return this.data;
  }

  getProgress(): ProgressData {
    return this.data;
  }

  recordAttempt(levelId: string): ProgressData {
    const next = this.patch(levelId, (p) => ({ ...p, attempts: p.attempts + 1 }), levelId);
    const state = next.server?.states[levelId];
    if (next.server && state?.status === 'available') {
      this.data = { ...next, server: { ...next.server, states: { ...next.server.states, [levelId]: { ...state, status: 'in_progress' } } } };
    }
    return this.data;
  }

  setLevelComplete(levelId: string, result: { stars: number; time: number }): ProgressData {
    return this.patch(levelId, (p) => ({
      ...p,
      completed: true,
      bestStars: Math.max(p.bestStars, result.stars),
      bestTime: p.bestTime === null ? result.time : Math.min(p.bestTime, result.time),
      completedAt: p.completedAt ?? new Date().toISOString(),
    }));
  }

  setBestScore(levelId: string, time: number): ProgressData {
    return this.patch(levelId, (p) => ({ ...p, bestTime: p.bestTime === null ? time : Math.min(p.bestTime, time) }));
  }

  setStars(levelId: string, stars: number): ProgressData {
    return this.patch(levelId, (p) => ({ ...p, bestStars: Math.max(p.bestStars, stars) }));
  }

  getLastLevel(): string | null {
    return this.data.lastLevelId;
  }

  setLastLevel(levelId: string): ProgressData {
    this.data = { ...this.data, lastLevelId: levelId };
    return this.data;
  }

  /**
   * The server's verdict on a run, applied at once (stars, completion, newly
   * unlocked levels, totals); the next catalog refresh confirms it.
   */
  applyRun(levelId: string, finish: { passed: boolean; stars: number; unlockedLevels: readonly { slug: string }[]; stats: { totalXp: number; totalStars: number; levelsCompleted: number; currentStreak: number } | null }, time: number): ProgressData {
    if (finish.passed) this.setLevelComplete(levelId, { stars: finish.stars, time });
    const server = this.data.server;
    if (!server) return this.data;
    const states = { ...server.states };
    if (finish.passed && states[levelId]) states[levelId] = { ...states[levelId], status: 'completed', lockReason: null, unlock: [] };
    for (const { slug } of finish.unlockedLevels) {
      const st = states[slug];
      if (st && st.status === 'locked') states[slug] = { ...st, status: 'available', lockReason: null, unlock: [] };
    }
    const stats = finish.stats ? { xp: finish.stats.totalXp, stars: finish.stats.totalStars, levelsCompleted: finish.stats.levelsCompleted, streak: finish.stats.currentStreak } : server.stats;
    this.data = { ...this.data, server: { states, stats } };
    return this.data;
  }

  /** Server progress can't be reset from the browser. */
  resetProgress(): ProgressData {
    return this.data;
  }
}
