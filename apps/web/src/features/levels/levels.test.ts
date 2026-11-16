import { validateMap } from '@robolab/map-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelRegistry } from '../../content/levels/registry';
import { WorldRegistry } from '../../content/worlds/registry';
import type { LevelDefinition } from '../../content/levels/types';
import { Analytics, type AnalyticsEvent } from '../analytics/analytics';
import { memoryStorage } from '../persistence/storage';
import { isBlockType } from '../programming/blocks/block-registry';
import { setProgramStorage, useProgramStore } from '../programming/state/program-store';
import { back, buildProgram, drop, forever, fwd, ifThen, left, obstacle, pick, repeat, right, speed, step, stop, type Spec } from '../programming/test-utils';
import { loadSettings, resolveReducedMotion, setSettingsStorage, useSettingsStore, DEFAULT_SETTINGS } from '../settings/settings-store';
import { shortcutFor } from '../shortcuts/keymap';
import { setProgressStore, useLevelStore } from './level-store';
import { levelStatus, LocalProgressStore } from './progress';
import { scoreRun } from './stars';
import { applyVariant } from '../../content/levels/variants';
import { layouts, playLevel } from './play';
import { SOLUTIONS, type Solution } from './reference-solutions';

/** Reference solutions of the other worlds (Starter Island's live in `reference-solutions.ts`). */
const OTHER: Record<string, Spec[]> = {
  'canyon-01': [repeat(2, [fwd(100), left(90), fwd(100), right(90)])],
  'canyon-02': [forever([ifThen(obstacle, [stop()]), fwd(5)])],
  'canyon-03': [fwd(380), right(90), fwd(120)],
  'frost-01': [fwd(260), left(90), fwd(300), right(90), fwd(320)],
  'jungle-01': [fwd(180), right(90), fwd(220), left(90), fwd(240)],
};
const solutionOf = (id: string): Solution | undefined => SOLUTIONS[id] ?? (OTHER[id] && { stack: OTHER[id]! });

function play(level: LevelDefinition, stack: readonly Spec[], variant = 0) {
  return playLevel(level, buildProgram(stack, ['score', 'side', 'count', 'greens', 'length']), variant);
}
const playSolution = (level: LevelDefinition, s: Solution, variant = 0) => playLevel(level, buildProgram(s.stack, s.variables ?? [], s.functions ?? {}), variant);
const get = (id: string) => LevelRegistry.get(id) as LevelDefinition;
/** Outcome of a run: success, or the mission's failure reason / 'unfinished'. */
const outcome = (level: LevelDefinition, stack: readonly Spec[], variant = 0) => {
  const m = play(level, stack, variant).sim.snapshot().mission;
  return m?.status === 'success' ? 'success' : (m?.failureReason ?? 'unfinished');
};

describe('level content', () => {
  it('registry ids are unique and every level (and layout) is well-formed', () => {
    const ids = LevelRegistry.all.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const level of LevelRegistry.all) {
      for (const v of layouts(level)) {
        const played = applyVariant(level, v);
        expect(validateMap(played.map).filter((i) => i.severity === 'error'), `${level.id}#${v}`).toEqual([]);
        const checkpoints = new Set(played.map.entities.filter((e) => e.type === 'checkpoint').map((e) => e.id));
        for (const o of level.mission.objectives) if (o.type === 'reachCheckpoint') expect(checkpoints.has(o.checkpointId), `${level.id}#${v}:${o.id}`).toBe(true);
      }
      expect(level.mission.mapId).toBe(level.map.id);
      if (level.allowedBlocks !== 'all') for (const t of level.allowedBlocks) expect(isBlockType(t), `${level.id}:${t}`).toBe(true);
      expect(level.hints.length).toBeGreaterThan(0);
      // levels.brief_description is limited to 200 characters in the database.
      expect(level.description.length, `${level.id} description`).toBeLessThanOrEqual(200);
      expect(WorldRegistry.get(level.world), level.id).toBeDefined();
    }
  });

  // Long missions (the factory, the explorer) simulate minutes of driving: allow time on a busy machine.
  it.each(LevelRegistry.all.map((l) => [l.id, l] as const))('%s is solvable on every layout with its reference solution', { timeout: 120000 }, (id, level) => {
    const solution = solutionOf(id);
    expect(solution, `add a reference solution for ${id}`).toBeDefined();
    for (const v of layouts(level)) {
      const { sim } = playSolution(level, solution!, v);
      expect(sim.state, `${id}#${v}`).toBe('success');
      expect(sim.snapshot().mission?.collisionCount, `${id}#${v}`).toBe(0);
    }
  });

  it('every Starter Island mission uses the mission framework (briefing, four tiered hints, scoring from its stars)', () => {
    for (const l of LevelRegistry.byWorld('starter-island')) {
      expect(l.briefing, l.id).toBeDefined();
      expect(l.hints, l.id).toHaveLength(4);
      expect(l.mission.scoring.efficiencyBonus?.parBlocks, l.id).toBe(l.stars.parBlocks);
      expect(l.mission.scoring.timeBonus?.parSeconds, l.id).toBe(l.stars.parSeconds);
    }
  });

  it('Level 1: the robot must come to rest inside the delivery zone', () => {
    const level = get('starter-01');
    expect(play(level, [step(3), left(90), step(2)]).sim.state).toBe('success');
    const over = play(level, [step(3), left(90), fwd(155)]);
    expect(over.sim.state).toBe('finished');
    expect(over.sim.snapshot().mission?.objectives.find((o) => o.objectiveId === 'goal')?.completed).toBe(false);
    expect(play(level, [step(3), left(90), fwd(220)]).sim.state).toBe('error');
    expect(play(level, [step(3), left(90), fwd(80)]).sim.snapshot().mission?.status).not.toBe('success');
  });

  it('Levels 2 and 3: every corner and every piece of debris matters', () => {
    expect(play(get('starter-02'), [fwd(120), right(90), fwd(120)]).sim.state).toBe('error');
    expect(play(get('starter-03'), [fwd(250)]).sim.state).toBe('error');
    expect(play(get('starter-03'), [fwd(80), left(90), fwd(50), right(90), fwd(200)]).sim.state).toBe('error');
  });

  it('the new mechanics cannot be skipped (a naive program fails)', () => {
    // 4: driving to the bank without building the bridge.
    expect(outcome(get('starter-04'), [fwd(430)])).toBe('unfinished');
    // 5: no waiting at the lights.
    expect(outcome(get('starter-05'), [fwd(300), left(90), fwd(220)])).toBe('redLight');
    // 6: straight east reaches hiker 2 first.
    expect(outcome(get('starter-06'), [fwd(300)])).toBe('wrongOrder');
    // 7: always the near bridge.
    expect(outcome(get('starter-07'), [fwd(140), left(90), fwd(220), right(90), fwd(100)], 0)).toBe('collision');
    // 9: every crate to the red warehouse.
    expect(outcome(get('starter-09'), [repeat(4, [pick(), right(180), fwd(170), drop(), left(180), fwd(170)])], 1)).toBe('wrongDelivery');
    // 10: not waiting at the scanner.
    expect(outcome(get('starter-10'), [fwd(400)])).toBe('collision');
    // 11: ignoring the lights.
    expect(outcome(get('starter-11'), [speed(100), fwd(520)])).toBe('redLight');
    // 14: straight down the flooded street.
    expect(outcome(get('starter-14'), [fwd(500)], 0)).toBe('hazard');
    // 16: always station 1.
    expect(outcome(get('starter-16'), [fwd(80), left(90), fwd(60), back(60), right(90), back(80)], 2)).toBe('hazard');
    // 18: always the second bay.
    expect(outcome(get('starter-18'), [fwd(140), left(90), fwd(60)], 2)).toBe('collision');
    // 24: full speed down the avenue.
    expect([0, 1, 2].map((v) => outcome(get('starter-24'), [speed(100), fwd(420)], v))).toContain('collision');
  });

  it('failure: crashing fails the level mission', () => {
    const { sim } = play(get('starter-01'), [right(90), fwd(100)]);
    expect(sim.state).toBe('error');
    expect(sim.snapshot().mission?.status).toBe('failure');
  });
});

describe('progress', () => {
  it('persists attempts, best stars and best time across store instances', () => {
    const storage = memoryStorage();
    const a = new LocalProgressStore(storage);
    a.recordAttempt('starter-01');
    a.setLevelComplete('starter-01', { stars: 2, time: 9 });
    a.setLevelComplete('starter-01', { stars: 1, time: 12 }); // worse run never lowers the best
    a.setLastLevel('starter-01');
    const b = new LocalProgressStore(storage);
    expect(b.getProgress().levels['starter-01']).toMatchObject({ completed: true, bestStars: 2, bestTime: 9, attempts: 1 });
    expect(b.getLastLevel()).toBe('starter-01');
    b.resetProgress();
    expect(new LocalProgressStore(storage).getProgress().levels).toEqual({});
  });

  it('unlocks levels in order', () => {
    const order = ['a', 'b', 'c'];
    const store = new LocalProgressStore(memoryStorage());
    expect(levelStatus('a', order, store.getProgress())).toBe('available');
    expect(levelStatus('b', order, store.getProgress())).toBe('locked');
    store.recordAttempt('a');
    expect(levelStatus('a', order, store.getProgress())).toBe('in_progress');
    store.setLevelComplete('a', { stars: 1, time: 5 });
    expect(levelStatus('a', order, store.getProgress())).toBe('completed');
    expect(levelStatus('b', order, store.getProgress())).toBe('available');
    expect(levelStatus('c', order, store.getProgress())).toBe('locked');
  });
});

describe('stars', () => {
  const level = LevelRegistry.get('starter-03') as LevelDefinition; // par: 12 blocks, 32 s
  it('awards one star per criterion met', () => {
    expect(scoreRun({ time: 30, blockCount: 12, collisions: 0 }, level).stars).toBe(3);
    expect(scoreRun({ time: 50, blockCount: 12, collisions: 0 }, level).stars).toBe(2);
    expect(scoreRun({ time: 50, blockCount: 15, collisions: 0 }, level).stars).toBe(1);
  });
  it('real solutions earn three stars on par levels', { timeout: 240000 }, () => {
    for (const l of LevelRegistry.all) {
      const { sim, blockCount } = playSolution(l, solutionOf(l.id)!);
      const s = scoreRun({ time: sim.snapshot().time, blockCount, collisions: 0 }, l);
      expect(s.stars, `${l.id} (${blockCount} blocks, ${sim.snapshot().time.toFixed(1)} s)`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('level session', () => {
  let events: AnalyticsEvent[];
  beforeEach(() => {
    vi.useFakeTimers();
    setProgramStorage(memoryStorage());
    setProgressStore(new LocalProgressStore(memoryStorage()));
    events = [];
    Analytics.use({ track: (e) => void events.push(e) });
    useLevelStore.getState().loadLevel('starter-01');
  });
  afterEach(() => vi.useRealTimers());

  it('loads levels (locked ones are refused) and tracks analytics', () => {
    expect(useLevelStore.getState().levelId).toBe('starter-01');
    expect(useLevelStore.getState().introOpen).toBe(true);
    expect(useLevelStore.getState().loadLevel('starter-02')).toBe(false); // locked
    expect(events).toContain('level_started');
  });

  it('completion scores stars, saves progress, unlocks and moves to the next level', () => {
    useLevelStore.getState().completeRun({ time: 6, blockCount: 1, collisions: 0 });
    vi.runAllTimers();
    const r = useLevelStore.getState().result;
    expect(r?.kind === 'success' && r.stars).toBe(3);
    expect(r?.kind === 'success' && r.nextLevelId).toBe('starter-02');
    expect(useLevelStore.getState().status('starter-01')).toBe('completed');
    expect(useLevelStore.getState().status('starter-02')).toBe('available');
    useLevelStore.getState().nextLevel();
    expect(useLevelStore.getState().levelId).toBe('starter-02');
    expect(useLevelStore.getState().result).toBeNull();
    // replay keeps the best score
    useLevelStore.getState().loadLevel('starter-01');
    useLevelStore.getState().completeRun({ time: 30, blockCount: 4, collisions: 0 });
    expect(useLevelStore.getState().progress.levels['starter-01']?.bestStars).toBe(3);
  });

  it('failure shows a result; retry clears it and keeps the program', () => {
    useProgramStore.getState().addBlock('motion.forward', { kind: 'after', blockId: 'start' });
    const program = useProgramStore.getState().program;
    useLevelStore.getState().failRun('Robot stopped', 'The robot hit a barrier.');
    vi.runAllTimers();
    expect(useLevelStore.getState().result?.kind).toBe('failure');
    useLevelStore.getState().retry();
    expect(useLevelStore.getState().result).toBeNull();
    expect(useProgramStore.getState().program).toBe(program);
  });

  it('hints are revealed one at a time', () => {
    useLevelStore.getState().revealHint();
    useLevelStore.getState().revealHint();
    expect(useLevelStore.getState().hintsShown).toBe(2);
    expect(events).toContain('hint_used');
  });
});

describe('program persistence per level', () => {
  it('each level keeps its own program', () => {
    setProgramStorage(memoryStorage());
    const store = useProgramStore.getState;
    store().switchLevel('lvl-a');
    store().addBlock('motion.forward', { kind: 'after', blockId: 'start' });
    const aBlocks = Object.keys(store().program.blocks).length;
    store().switchLevel('lvl-b');
    expect(Object.keys(store().program.blocks)).toEqual(['start']);
    store().switchLevel('lvl-a');
    expect(Object.keys(store().program.blocks)).toHaveLength(aBlocks);
    store().resetProgram();
    expect(Object.keys(store().program.blocks)).toEqual(['start']);
  });
});

describe('settings', () => {
  it('persist and fall back to defaults', () => {
    const storage = memoryStorage();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    setSettingsStorage(storage);
    useSettingsStore.getState().set({ sound: false, quality: 'low', volume: 3 });
    const loaded = loadSettings(storage);
    expect(loaded.sound).toBe(false);
    expect(loaded.quality).toBe('low');
    expect(loaded.volume).toBe(1); // clamped
  });

  it('reduced motion follows the OS unless overridden', () => {
    expect(resolveReducedMotion(null, true)).toBe(true);
    expect(resolveReducedMotion(null, false)).toBe(false);
    expect(resolveReducedMotion(false, true)).toBe(false);
    expect(resolveReducedMotion(true, false)).toBe(true);
  });
});

describe('keyboard shortcuts', () => {
  it('maps keys to actions and never fires while typing', () => {
    expect(shortcutFor({ key: ' ' })).toBe('runStop');
    expect(shortcutFor({ key: ' ', overWorkspace: true })).toBeNull(); // Space pans the workspace
    expect(shortcutFor({ key: 'r' })).toBe('resetRobot');
    expect(shortcutFor({ key: 'f' })).toBe('focusRobot');
    expect(shortcutFor({ key: 'Escape' })).toBe('closeOverlay');
    expect(shortcutFor({ key: 'r', typing: true })).toBeNull();
    expect(shortcutFor({ key: 'r', ctrlKey: true })).toBeNull(); // Ctrl+R is the browser's
  });
});

describe('analytics', () => {
  it('routes events to the configured sink and never throws', () => {
    const got: string[] = [];
    const prev = Analytics.use({ track: (e) => void got.push(e) });
    Analytics.track('program_run', { blocks: 3 });
    Analytics.use({
      track: () => {
        throw new Error('sink down');
      },
    });
    expect(() => Analytics.track('collision')).not.toThrow();
    Analytics.use(prev);
    expect(got).toEqual(['program_run']);
  });
});
