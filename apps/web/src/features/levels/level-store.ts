import { create } from 'zustand';
import { LevelRegistry, migrateLevelId } from '../../content/levels/registry';
import type { LevelDefinition } from '../../content/levels/types';
import { logToConsole } from '../../stores/console-store';
import { messagesFor } from '../i18n/i18n';
import { levelsMessages } from './levels.messages';
import { useSimulationStore } from '../../stores/simulation-store';
import { useUiStore } from '../../stores/ui-store';
import { Analytics } from '../analytics/analytics';
import { useProgramStore } from '../programming/state/program-store';
import { useSettingsStore } from '../settings/settings-store';
import { ApiError } from '../api/client';
import { studentApi, type RunFinish, type RunOutcome, type RunReport } from '../account/student-api';
import { LocalProgressStore, levelStatus, ServerProgressStore, type LevelStatus, type ProgressData, type ProgressStore } from './progress';
import { beginRun, endRun, type FinishResult } from './run-session';
import { scoreRun, type StarBreakdown } from './stars';
import { pickVariant } from './variant-store';

/** Where a successful result stands with the server. `local` = no server (offline/local mode). */
export type ResultSync = 'local' | 'saving' | 'saved' | 'offline' | 'unsaved';

export type LevelResult =
  | ({
      readonly kind: 'success';
      readonly time: number;
      readonly blockCount: number;
      readonly newBest: boolean;
      readonly nextLevelId: string | null;
      readonly sync: ResultSync;
      /** XP the server awarded for this run (null until saved). */
      readonly xpEarned: number | null;
      /** Objectives as judged by the server (null until saved). */
      readonly objectives: readonly { readonly code: string; readonly title: string; readonly completed: boolean; readonly required: boolean }[] | null;
      readonly achievements: readonly string[];
      /** Explanation when the result isn't (yet) saved. */
      readonly note: string | null;
    } & StarBreakdown)
  | { readonly kind: 'failure'; readonly title: string; readonly message: string }
  | { readonly kind: 'incomplete'; readonly message: string };

/** What the simulator observed, for the server (objective ids are the level's objective codes). */
export interface RunFacts {
  readonly time: number;
  readonly blockCount: number;
  readonly collisions: number;
  readonly objectivesCompleted?: readonly string[];
}

interface LevelSessionState {
  levelId: string;
  progress: ProgressData;
  introOpen: boolean;
  hintsShown: number;
  /** A paid hint is being unlocked / why it couldn't be. */
  hintBusy: boolean;
  hintError: string | null;
  result: LevelResult | null;

  /**
   * Make sure a level is loaded when the simulator opens. With an id (from
   * the URL) that level is loaded unless it's locked/unknown; otherwise the
   * current level is kept, or the last played one is loaded. Returns the loaded id.
   */
  enter: (levelId?: string | null) => string;
  loadLevel: (id: string, opts?: { intro?: boolean }) => boolean;
  dismissIntro: () => void;
  revealHint: () => void;
  /** Run reached every objective. */
  completeRun: (run: RunFacts) => void;
  /** Run ended by a crash (collision) or a runtime error. */
  failRun: (title: string, message: string, run?: RunFacts, outcome?: RunOutcome) => void;
  /** Program ended without finishing the mission. */
  incompleteRun: (message: string, run?: RunFacts) => void;
  /** The student stopped the run. */
  stopRun: (run?: RunFacts) => void;
  /** Reset robot + runtime + mission; keep the program. */
  retry: () => void;
  /** Restart the level: robot, mission, hints and intro (program kept). */
  resetLevel: () => void;
  nextLevel: () => void;
  resetProgress: () => void;
  status: (id: string) => LevelStatus;
}

let progressStore: ProgressStore = new LocalProgressStore();
/** Swap the progress backend (tests; the API catalog after sign-in). */
export const setProgressStore = (store: ProgressStore) => {
  progressStore = store;
  useLevelStore.setState({ progress: store.getProgress() });
};

/** Server-backed progress is in use (a signed-in student). */
const serverMode = () => progressStore instanceof ServerProgressStore;

/** Set by the catalog store: reload the student's catalog (states, stats) from the API. */
let refreshCatalog: () => Promise<void> = async () => {};
export const setCatalogRefresher = (fn: () => Promise<void>) => {
  refreshCatalog = fn;
};

/** Back to a clean session (catalog swapped, signed out). */
export function resetLevelSession(): void {
  loaded = false;
  clearTimeout(resultTimer);
  useLevelStore.setState({ levelId: LevelRegistry.first().id, result: null, introOpen: false, hintsShown: 0, hintBusy: false, hintError: null, progress: progressStore.getProgress() });
}

/** The next mission the student can open after `levelId` (the following one if open, else the first open one after it). */
export function nextOpenLevel(levelId: string): string | null {
  const all = LevelRegistry.all;
  const i = all.findIndex((l) => l.id === levelId);
  const after = [...all.slice(i + 1), ...all.slice(0, Math.max(0, i))];
  const open = after.find((l) => {
    const st = useLevelStore.getState().status(l.id);
    return st === 'available' || st === 'in_progress';
  });
  return open?.id ?? null;
}

const reportOf = (run: RunFacts | undefined): RunReport => ({
  objectivesCompleted: run?.objectivesCompleted ?? [],
  timeSeconds: Math.max(0, Math.round((run?.time ?? 0) * 1000) / 1000),
  collisions: run?.collisions ?? 0,
});

const clampStars = (n: number) => Math.max(0, Math.min(3, n)) as StarBreakdown['stars'];

const order = () => LevelRegistry.all.map((l) => l.id);
/** A level has been loaded into the simulator this session. */
let loaded = false;
let resultTimer: ReturnType<typeof setTimeout> | undefined;

export const currentLevel = (): LevelDefinition => LevelRegistry.get(useLevelStore.getState().levelId) ?? LevelRegistry.first();

/**
 * Level session: which level is loaded, intro / hints / result overlays,
 * and progress (stars, unlocks). Loading a level swaps world, mission,
 * allowed blocks and the saved program without reloading the app.
 */
export const useLevelStore = create<LevelSessionState>()((set, get) => ({
  levelId: LevelRegistry.first().id,
  progress: progressStore.getProgress(),
  introOpen: false,
  hintsShown: 0,
  hintBusy: false,
  hintError: null,
  result: null,

  enter: (levelId) => {
    const wanted = levelId ? migrateLevelId(levelId) : null;
    if (wanted && (!loaded || wanted !== get().levelId) && get().loadLevel(wanted, { intro: true })) return wanted;
    if (!loaded) {
      const last = progressStore.getLastLevel();
      const target = last && LevelRegistry.get(last) && get().status(last) !== 'locked' ? last : LevelRegistry.first().id;
      get().loadLevel(target, { intro: true });
    }
    return get().levelId;
  },


  loadLevel: (id, opts = {}) => {
    const level = LevelRegistry.get(id);
    if (!level || get().status(id) === 'locked' || level.server?.playable === false) return false;
    clearTimeout(resultTimer);
    loaded = true;
    pickVariant(level);
    useProgramStore.getState().switchLevel(id);
    const ui = useUiStore.getState();
    ui.setMapId(level.map.id);
    ui.setCameraView(level.camera ?? 'chase');
    if (useSimulationStore.getState().status !== 'idle') useSimulationStore.getState().reset();
    set({
      levelId: id,
      progress: progressStore.setLastLevel(id),
      introOpen: opts.intro ?? true,
      hintsShown: firstHiddenHint(level),
      hintBusy: false,
      hintError: null,
      result: null,
    });
    logToConsole('info', messagesFor(levelsMessages).missionLog({ code: LevelRegistry.code(level), title: level.title }));
    Analytics.track('level_started', { level: id });
    return true;
  },

  dismissIntro: () => set({ introOpen: false }),

  revealHint: () => {
    const level = currentLevel();
    const i = get().hintsShown;
    if (i >= level.hints.length || get().hintBusy) return;
    const info = level.server?.hints[i];
    // Paid hints are unlocked on the server (it charges the XP once).
    if (info && !info.revealed) {
      set({ hintBusy: true, hintError: null });
      studentApi.revealHint(level.id, info.id).then(
        (res) => {
          const hints = level.hints.map((h, k) => (k === i ? res.hint.content : h));
          const server = { ...level.server!, hints: level.server!.hints.map((h, k) => (k === i ? { ...h, revealed: true } : h)) };
          LevelRegistry.replace({ ...level, hints, server });
          Analytics.track('hint_used', { level: level.id, hint: i + 1 });
          set({ hintBusy: false, hintsShown: firstHiddenHint(LevelRegistry.get(level.id) ?? level, i + 1) });
          void refreshCatalog();
        },
        (e: unknown) =>
          set({
            hintBusy: false,
            hintError: e instanceof ApiError && e.code === 'NOT_ENOUGH_XP' ? messagesFor(levelsMessages).hintNeedXp({ cost: info.cost }) : messagesFor(levelsMessages).hintFailed,
          }),
      );
      return;
    }
    Analytics.track('hint_used', { level: level.id, hint: i + 1 });
    set({ hintsShown: i + 1, hintError: null });
  },

  completeRun: (run) => {
    const { time, blockCount, collisions } = run;
    const level = currentLevel();
    const score = scoreRun({ time, blockCount, collisions }, level);
    const before = progressStore.getProgress().levels[level.id];
    Analytics.track('level_completed', { level: level.id, stars: score.stars, time: Math.round(time * 10) / 10, blocks: blockCount });
    const base = {
      kind: 'success' as const,
      ...score,
      time,
      blockCount,
      newBest: score.stars > (before?.bestStars ?? 0),
      nextLevelId: LevelRegistry.next(level.id)?.id ?? null,
      sync: 'local' as ResultSync,
      xpEarned: null,
      objectives: null,
      achievements: [],
      note: null,
    };
    clearTimeout(resultTimer);
    const delay = useSettingsStore.getState().reduceMotion ? 250 : 1300;

    if (!serverMode()) {
      set({ progress: progressStore.setLevelComplete(level.id, { stars: score.stars, time }) });
      // Let the goal / success animation play before the panel appears.
      resultTimer = setTimeout(() => set({ result: base }), delay);
      return;
    }

    // Server mode: the panel opens with "saving…" and shows the server's verdict.
    resultTimer = setTimeout(() => {
      if (!get().result || get().result?.kind === 'success') set((s) => ({ result: s.result ?? { ...base, sync: 'saving', nextLevelId: null } }));
    }, delay);
    const apply = (finish: RunFinish) => {
      if (get().levelId !== level.id) return;
      if (!finish.passed) {
        set({ result: { kind: 'failure', title: messagesFor(levelsMessages).notQuiteTitle, message: finish.reasons.join(' ') || messagesFor(levelsMessages).notCompleteYet } });
        return;
      }
      // Store the new progress first: the next mission is chosen from the states it unlocked.
      set({ progress: (progressStore as ServerProgressStore).applyRun(level.id, finish, time) });
      set({
        result: {
          ...base,
          stars: clampStars(finish.stars),
          criteria: finish.criteria,
          newBest: finish.newBest,
          nextLevelId: nextOpenLevel(level.id),
          sync: 'saved',
          xpEarned: finish.xpEarned,
          objectives: finish.objectives,
          achievements: finish.achievementsUnlocked,
          note: null,
        },
      });
      void refreshCatalog();
    };
    void endRun('COMPLETED', reportOf(run)).then((res: FinishResult) => {
      clearTimeout(resultTimer);
      if (res.kind === 'saved') return apply(res.finish);
      set({
        result: {
          ...base,
          sync: res.kind,
          note: res.kind === 'offline' ? messagesFor(levelsMessages).offlineNote : res.message,
        },
      });
      if (res.kind === 'offline') void res.retry.then((f) => f && apply(f));
    });
  },

  failRun: (title, message, run, outcome = 'FAILED') => {
    Analytics.track('level_failed', { level: get().levelId });
    if (serverMode()) void endRun(outcome, reportOf(run));
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => set({ result: { kind: 'failure', title, message } }), 450);
  },

  incompleteRun: (message, run) => {
    if (serverMode()) void endRun('FAILED', reportOf(run));
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => set({ result: { kind: 'incomplete', message } }), 400);
  },

  stopRun: (run) => {
    if (serverMode()) void endRun('STOPPED', reportOf(run));
  },

  retry: () => {
    clearTimeout(resultTimer);
    useSimulationStore.getState().reset();
    set({ result: null });
  },

  resetLevel: () => {
    clearTimeout(resultTimer);
    useSimulationStore.getState().reset();
    set({ result: null, hintsShown: 0, introOpen: true });
  },

  nextLevel: () => {
    const next = serverMode() ? nextOpenLevel(get().levelId) : (LevelRegistry.next(get().levelId)?.id ?? null);
    if (next) get().loadLevel(next, { intro: true });
    else set({ result: null });
  },

  resetProgress: () => {
    set({ progress: progressStore.resetProgress() });
    get().loadLevel(LevelRegistry.first().id, { intro: true });
  },

  status: (id) => levelStatus(id, order(), get().progress),
}));

/**
 * How many hints to show when a level opens (or after one is unlocked):
 * free hints are revealed one at a time, but paid hints the student already
 * bought — and everything before them — stay open.
 */
function firstHiddenHint(level: LevelDefinition, from = 0): number {
  const info = level.server?.hints ?? [];
  let last = from;
  info.forEach((h, i) => {
    if (h.cost > 0 && h.revealed && i + 1 > last) last = i + 1;
  });
  return Math.min(level.hints.length, last);
}

/** Record a run attempt (called when a run starts); with a server, the run is registered there too. */
export const recordAttempt = () => {
  const { levelId } = useLevelStore.getState();
  useLevelStore.setState({ progress: progressStore.recordAttempt(levelId) });
  if (serverMode()) beginRun(levelId);
};

// A new run or a robot reset dismisses any result panel (and cancels a pending one).
useSimulationStore.subscribe((s, prev) => {
  if (s.status !== prev.status && (s.status === 'idle' || s.status === 'running')) {
    clearTimeout(resultTimer);
    if (useLevelStore.getState().result) useLevelStore.setState({ result: null });
  }
});
