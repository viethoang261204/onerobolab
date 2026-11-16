import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelRegistry } from '../../content/levels/registry';
import { WorldRegistry } from '../../content/worlds/registry';
import { HOME_ACTIONS, runHomeAction } from '../home/home-actions';
import { ContinueLearningCard } from '../home/components/ContinueLearningCard';
import { ProgressStats } from '../home/components/ProgressStats';
import { HomePage } from '../home/pages/HomePage';
import { LevelDetailPanel } from '../level-selection/components/LevelDetailPanel';
import { levelObjectives, levelTools, starGoals } from '../level-selection/level-info';
import { startMission } from '../level-selection/start-mission';
import { setProgressStore, useLevelStore } from '../levels/level-store';
import { learningStreak, LocalProgressStore, migrateProgress, type ProgressData } from '../levels/progress';
import { useOnboardingStore } from '../onboarding/onboarding-store';
import { memoryStorage } from '../persistence/storage';
import { setProgramStorage } from '../programming/state/program-store';
import { navigate, useRouterStore } from '../router/router-store';
import { parseRoute, paths } from '../router/routes';
import { MapLabels } from './components/MapLabels';
import { WorldDetailPanel } from './components/WorldDetailPanel';
import { pathSegments, resolveWorldRoute } from './map-view';
import { ISLAND_RADIUS } from './scene/island-decor';
import { islandDiorama } from './scene/island-diorama';
import { islandGround, islandSeed } from './scene/island-terrain';
import { journeyCenter, journeyPlacement } from './scene/journey-layout';
import { continueTarget, currentWorld, playerStats, summarizeWorld, summarizeWorlds } from './world-progress';

/** Server-render to HTML without React's text separators. */
const html = (el: ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

const EMPTY: ProgressData = { version: 1, levels: {}, lastLevelId: null };
const done = (stars = 3) => ({ completed: true, bestStars: stars, bestTime: 10, attempts: 1, completedAt: '2026-09-01T10:00:00.000Z' });
const tried = { completed: false, bestStars: 0, bestTime: null, attempts: 2, completedAt: null };
const firstThree: ProgressData = { version: 1, levels: { 'starter-01': done(3), 'starter-02': done(2), 'starter-03': done(1) }, lastLevelId: 'starter-03' };
/** All 24 Starter Island missions: 3 + 2 + 1 stars on the first three, 3 stars on the rest. */
const starterDone: ProgressData = {
  ...firstThree,
  levels: { ...Object.fromEntries(LevelRegistry.byWorld('starter-island').map((l) => [l.id, done()])), ...firstThree.levels },
  lastLevelId: 'starter-24',
};
const summary = (id: string, p: ProgressData) => summarizeWorld(WorldRegistry.get(id)!, p);

/** Fresh session: in-memory progress/programs, router at "/". */
function resetApp(progress?: ProgressData) {
  const storage = memoryStorage();
  if (progress) storage.setItem('roboverse.progress.v1', JSON.stringify(progress));
  setProgramStorage(memoryStorage());
  setProgressStore(new LocalProgressStore(storage));
  useRouterStore.setState({ path: '/', route: parseRoute('/') });
}

describe('routes', () => {
  it('parses every app URL shape', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' });
    expect(parseRoute('/home')).toEqual({ name: 'home' });
    expect(parseRoute('/world')).toEqual({ name: 'world', worldId: null, levelId: null });
    expect(parseRoute('/explore')).toEqual({ name: 'world', worldId: null, levelId: null });
    expect(parseRoute('/world/canyon-circuit')).toEqual({ name: 'world', worldId: 'canyon-circuit', levelId: null });
    expect(parseRoute('/world/starter-island/level/starter-02')).toEqual({ name: 'world', worldId: 'starter-island', levelId: 'starter-02' });
    expect(parseRoute('/simulator')).toEqual({ name: 'simulator', levelId: null });
    expect(parseRoute('/simulator/starter-01?x=1')).toEqual({ name: 'simulator', levelId: 'starter-01' });
    expect(parseRoute('/world/a/oops/b').name).toBe('notFound');
    expect(parseRoute('/nope').name).toBe('notFound');
  });

  it('builders round-trip through the parser', () => {
    expect(parseRoute(paths.level('starter-island', 'starter-03'))).toEqual({ name: 'world', worldId: 'starter-island', levelId: 'starter-03' });
    expect(parseRoute(paths.simulator('frost-01'))).toEqual({ name: 'simulator', levelId: 'frost-01' });
    expect(parseRoute(paths.world('sky-lab'))).toEqual({ name: 'world', worldId: 'sky-lab', levelId: null });
  });

  it('navigate updates the route (no-op for the same path)', () => {
    resetApp();
    navigate('/world/starter-island');
    expect(useRouterStore.getState().route).toEqual({ name: 'world', worldId: 'starter-island', levelId: null });
    const before = useRouterStore.getState();
    navigate('/world/starter-island');
    expect(useRouterStore.getState()).toBe(before);
  });
});

describe('world data', () => {
  it('worlds are ordered, unique, and every level belongs to one', () => {
    const ids = WorldRegistry.all.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WorldRegistry.all.map((w) => w.order)).toEqual(ids.map((_, i) => i + 1));
    for (const l of LevelRegistry.all) expect(WorldRegistry.get(l.world), l.id).toBeDefined();
    // Play order never goes back to an earlier world.
    const orders = LevelRegistry.all.map((l) => WorldRegistry.get(l.world)!.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it('no curriculum codes leak into names (CS1 / GD1 …)', () => {
    const text = JSON.stringify([WorldRegistry.all, LevelRegistry.all.map((l) => [l.id, l.title, LevelRegistry.code(l)])]);
    expect(text).not.toMatch(/\b(CS|GD)\d/i);
    expect(LevelRegistry.code(LevelRegistry.get('starter-02')!)).toBe('1-2');
  });

  it('explore journey: worlds recede into the distance, the first one largest', () => {
    for (const n of [6, 9]) {
      const all = Array.from({ length: n }, (_, i) => journeyPlacement(i + 1, n));
      for (let i = 1; i < n; i++) {
        expect(all[i]!.z, `${n}: world ${i + 1} further back`).toBeLessThan(all[i - 1]!.z);
        expect(all[i]!.y).toBeGreaterThanOrEqual(all[i - 1]!.y);
      }
      expect(all[0]!.scale).toBe(Math.max(...all.map((p) => p.scale)));
      // Neighbours never overlap (island radius × each scale).
      for (let i = 1; i < n; i++) expect(Math.hypot(all[i]!.x - all[i - 1]!.x, all[i]!.z - all[i - 1]!.z)).toBeGreaterThan(ISLAND_RADIUS * (all[i]!.scale + all[i - 1]!.scale));
      const c = journeyCenter(n);
      expect(Number.isFinite(c.x) && Number.isFinite(c.z)).toBe(true);
    }
  });

  it('island dioramas: handcrafted, deterministic, on the island, locked ones unlit', () => {
    for (const w of WorldRegistry.all) {
      const seed = islandSeed(w.order);
      const ground = islandGround(w.theme, seed);
      const a = islandDiorama(w.theme, seed, ground);
      expect(JSON.stringify(islandDiorama(w.theme, seed, ground).parts)).toBe(JSON.stringify(a.parts));
      expect(a.size, w.theme).toBeGreaterThan(60);
      expect(a.size, w.theme).toBeLessThan(700);
      for (const part of a.parts)
        for (const it of part.items) {
          const [x, , z] = it.p;
          expect(Math.hypot(x, z), `${w.theme} ${part.geometry}`).toBeLessThan(ISLAND_RADIUS);
        }
      // Six different places, not one recoloured.
      const locked = islandDiorama(w.theme, seed, ground, true);
      expect(locked.parts.some((p) => p.material.startsWith('glow'))).toBe(false);
    }
    const sig = (t: (typeof WorldRegistry.all)[number]) => islandDiorama(t.theme, 1, () => 0).parts.map((p) => `${p.geometry}:${p.items.length}`).join();
    expect(new Set(WorldRegistry.all.map(sig)).size).toBe(WorldRegistry.all.length);
  });
});

describe('world progress (derived from level progress)', () => {
  it('fresh student: first world open, next locked with a reason, empty worlds coming soon', () => {
    expect(summary('starter-island', EMPTY)).toMatchObject({ status: 'available', completed: 0, total: 24, maxStars: 72 });
    const canyon = summary('canyon-circuit', EMPTY);
    expect(canyon.status).toBe('locked');
    expect(canyon.lockedReason).toContain('Starter Island');
    expect(summary('jungle-ruins', EMPTY)).toMatchObject({ status: 'locked', total: 1 });
    expect(summary('sky-lab', EMPTY)).toMatchObject({ status: 'coming_soon', total: 0 });
  });

  it('progress: attempts → in progress, all done → completed and the next world unlocks', () => {
    expect(summary('starter-island', { ...EMPTY, levels: { 'starter-01': tried } }).status).toBe('in_progress');
    const s = summary('starter-island', starterDone);
    expect(s).toMatchObject({ status: 'completed', completed: 24, stars: 69, fraction: 1, nextLevel: null });
    expect(summary('starter-island', firstThree)).toMatchObject({ status: 'in_progress', completed: 3 });
    expect(summary('canyon-circuit', firstThree).status).toBe('locked');
    expect(summary('canyon-circuit', starterDone)).toMatchObject({ status: 'available', lockedReason: null });
    expect(currentWorld(summarizeWorlds(starterDone)).world.id).toBe('canyon-circuit');
  });

  it('continue target: first mission when fresh, unfinished last level, else the next open one', () => {
    expect(continueTarget(EMPTY)).toMatchObject({ fresh: true, allDone: false, level: { id: 'starter-01' } });
    expect(continueTarget({ ...EMPTY, levels: { 'starter-01': done() }, lastLevelId: 'starter-01' }).level.id).toBe('starter-02');
    expect(continueTarget({ ...EMPTY, levels: { 'starter-01': done(), 'starter-02': tried }, lastLevelId: 'starter-02' }).level.id).toBe('starter-02');
    const all = Object.fromEntries(LevelRegistry.all.map((l) => [l.id, done()]));
    expect(continueTarget({ ...EMPTY, levels: all, lastLevelId: 'frost-01' })).toMatchObject({ allDone: true, level: { id: 'frost-01' } });
  });

  it('player stats: XP → level, stars, missions, robots, streak', () => {
    const today = new Date(2026, 8, 29, 15);
    const stats = playerStats({ ...firstThree, activeDays: ['2026-09-27', '2026-09-28', '2026-09-29'] }, today);
    expect(stats).toMatchObject({ stars: 6, maxStars: 87, missionsCompleted: 3, missionsTotal: 29, robotsUnlocked: 1, streak: 3 });
    expect(stats.xp).toBe(50 + 75 + 100);
    expect(stats.level).toBe(1);
  });

  it('learning streak survives until a full day is missed', () => {
    const d = (s: string) => new Date(`${s}T12:00:00`);
    expect(learningStreak(['2026-09-27', '2026-09-28'], d('2026-09-29'))).toBe(2); // yesterday still counts
    expect(learningStreak(['2026-09-26', '2026-09-27'], d('2026-09-29'))).toBe(0);
    expect(learningStreak(undefined, d('2026-09-29'))).toBe(0);
  });

  it('progress store records active days (injectable clock) and migrates UI 6 level ids', () => {
    const storage = memoryStorage();
    storage.setItem('roboverse.progress.v1', JSON.stringify({ version: 1, levels: { 'cs1-01': done(2), 'gd1-02': tried }, lastLevelId: 'cs1-02' }));
    const store = new LocalProgressStore(storage, () => new Date(2026, 8, 29, 9));
    expect(store.getProgress().levels['starter-01']?.bestStars).toBe(2);
    expect(store.getProgress().levels['canyon-02']?.attempts).toBe(2);
    expect(store.getLastLevel()).toBe('starter-02');
    store.recordAttempt('starter-02');
    store.recordAttempt('starter-02');
    expect(store.getProgress().activeDays).toEqual(['2026-09-29']);
    expect(migrateProgress(EMPTY)).toEqual(EMPTY);
  });
});

describe('world map view', () => {
  const sums = (p: ProgressData) => summarizeWorlds(p);

  it('resolves world / mission URLs and redirects invalid ones', () => {
    expect(resolveWorldRoute(null, null, sums(EMPTY), EMPTY)).toMatchObject({ entered: null, redirect: null });
    expect(resolveWorldRoute('atlantis', null, sums(EMPTY), EMPTY).redirect).toBe('/world');
    expect(resolveWorldRoute('canyon-circuit', null, sums(EMPTY), EMPTY)).toMatchObject({ redirect: '/world', selectId: 'canyon-circuit' });
    expect(resolveWorldRoute('lava-core', null, sums(EMPTY), EMPTY)).toMatchObject({ redirect: '/world', selectId: 'lava-core' });
    expect(resolveWorldRoute('starter-island', null, sums(EMPTY), EMPTY).entered?.world.id).toBe('starter-island');
    expect(resolveWorldRoute('starter-island', 'starter-01', sums(EMPTY), EMPTY).level?.id).toBe('starter-01');
    expect(resolveWorldRoute('starter-island', 'starter-02', sums(EMPTY), EMPTY).redirect).toBe('/world/starter-island'); // locked mission
    expect(resolveWorldRoute('starter-island', 'frost-01', sums(EMPTY), EMPTY).redirect).toBe('/world/starter-island'); // other world
    expect(resolveWorldRoute('starter-island', 'cs1-01', sums(EMPTY), EMPTY).redirect).toBe('/world/starter-island/level/starter-01'); // legacy link
  });

  it('energy paths light up with progress; the selected world animates its links', () => {
    const fresh = pathSegments(sums(EMPTY), 'starter-island');
    expect(fresh).toHaveLength(WorldRegistry.all.length - 1);
    expect(fresh.map((s) => s.state)).toEqual([0, 0, 0, 0, 0]);
    expect(fresh[0]!.active).toBe(true);
    expect(pathSegments(sums(starterDone), null)[0]!.state).toBe(1);
  });
});

describe('level selection', () => {
  it('describes a mission from level data only', () => {
    const l = LevelRegistry.get('starter-02')!;
    expect(levelObjectives(l)).toEqual(['Inspect transformer A', 'Inspect transformer B', 'Stop on the charging pad', 'Don’t hit any obstacles']);
    expect(levelTools(l).map((c) => c.id)).toEqual(['movement']);
    expect(levelTools(LevelRegistry.get('frost-01')!).length).toBe(7);
    expect(starGoals(l)).toEqual(['Complete the mission', 'Use 8 blocks or fewer', 'Finish within 26 s']);
  });
});

describe('navigation flow: Home → World → Level → Simulator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApp();
  });
  afterEach(() => vi.useRealTimers());

  it('Start Mission loads the level (no duplicate intro) and opens the simulator', () => {
    navigate(paths.worldMap());
    navigate(paths.world('starter-island'));
    navigate(paths.level('starter-island', 'starter-01'));
    expect(startMission('starter-01')).toBe(true);
    expect(useRouterStore.getState().route).toEqual({ name: 'simulator', levelId: 'starter-01' });
    // Mission 1-1 has a briefing: it opens on it (BRIEFING → PREDICT → CODE).
    expect(useLevelStore.getState()).toMatchObject({ levelId: 'starter-01', introOpen: true });
    // The simulator page then "enters" the same level: nothing reloads, the briefing stays.
    expect(useLevelStore.getState().enter('starter-01')).toBe('starter-01');
    expect(useLevelStore.getState().introOpen).toBe(true);
    // Levels without a briefing skip it when started from the map.
    useLevelStore.getState().dismissIntro();
  });

  it('locked missions cannot be started', () => {
    navigate(paths.world('starter-island'));
    expect(startMission('starter-03')).toBe(false);
    expect(useRouterStore.getState().path).toBe('/world/starter-island');
  });

  it('Continue from Home opens the simulator with the intro card', () => {
    expect(startMission('starter-01', 'home')).toBe(true);
    expect(useLevelStore.getState().introOpen).toBe(true);
  });

  it('simulator URL with a locked level falls back to a playable one', () => {
    expect(useLevelStore.getState().enter('frost-01')).not.toBe('frost-01');
  });

  it('home quick actions route to existing features', () => {
    expect(HOME_ACTIONS.map((a) => a.id)).toEqual(['explore', 'simulator', 'practice', 'learn']);
    runHomeAction('explore');
    expect(useRouterStore.getState().path).toBe('/world');
    runHomeAction('simulator');
    expect(useRouterStore.getState().path).toBe('/studio');
    navigate('/');
    runHomeAction('learn');
    expect(useOnboardingStore.getState().pending).toBe('studio');
    expect(useRouterStore.getState().path).toBe('/studio');
    navigate('/');
    runHomeAction('practice');
    expect(useRouterStore.getState().path).toBe('/world');
  });
});

describe('rendering (server render, no DOM needed)', () => {
  beforeEach(() => resetApp());

  it('Home shows the hero, CTAs, first mission, all worlds and quick actions', () => {
    const page = html(<HomePage />);
    expect(page).toContain('Build. Code.');
    expect(page).toContain('Explore World');
    expect(page).toContain('Start your first mission');
    for (const w of WorldRegistry.all) expect(page).toContain(w.name);
    for (const a of HOME_ACTIONS) expect(page).toContain(a.label);
  });

  // (Server render always sees a store's initial state, so progress views are rendered from props.)
  it('Home progress views: continue card + stats', () => {
    const cont = html(<ContinueLearningCard target={continueTarget(starterDone)} />);
    expect(cont).toContain('Continue learning');
    expect(cont).toContain('Staircase');
    expect(cont).toContain('Mission 2-1 · Canyon Circuit');
    const stats = html(<ProgressStats stats={playerStats(starterDone, new Date(2026, 8, 29))} />);
    expect(stats).toContain('Stars earned');
    expect(stats).toMatch(/>69<\/span><span[^>]*>of 87/);
    expect(stats).toMatch(/>24<\/span><span[^>]*>of 29 done/);
  });

  it('world detail: open worlds offer Enter World, locked ones explain why', () => {
    const open = html(<WorldDetailPanel summary={summary('starter-island', EMPTY)} onEnter={() => undefined} onClose={() => undefined} />);
    expect(open).toContain('Enter World');
    expect(open).toContain('0 / 24 missions');
    const locked = html(<WorldDetailPanel summary={summary('canyon-circuit', EMPTY)} onEnter={() => undefined} onClose={() => undefined} />);
    expect(locked).not.toContain('Enter World');
    expect(locked).toContain('Finish every mission in Starter Island to unlock.');
  });

  it('level detail shows objectives, tools, reward and Start Mission', () => {
    const level = LevelRegistry.get('starter-01')!;
    const detail = html(<LevelDetailPanel level={level} world={WorldRegistry.first()} status="available" progress={undefined} onStart={() => undefined} onBack={() => undefined} />);
    expect(detail).toContain('Stop in the delivery zone');
    expect(detail).toContain('Movement');
    expect(detail).toContain('+50 XP');
    expect(detail).toContain('Start Mission');
    const replay = html(<LevelDetailPanel level={level} world={WorldRegistry.first()} status="completed" progress={undefined} skills={['Movement', 'Sequences']} onStart={() => undefined} onBack={() => undefined} />);
    expect(replay).toContain('Replay mission');
    expect(replay).toContain('Sequences');
  });

  it('map labels are labelled buttons (keyboard reachable), locked state in words', () => {
    const islands = summarizeWorlds(EMPTY).map((s, _i, all) => ({ summary: s, selected: false, hovered: false, current: false, placement: journeyPlacement(s.world.order, all.length) }));
    const labels = html(<MapLabels islands={islands} onSelect={() => undefined} onHover={() => undefined} />);
    expect(labels.match(/<button/g)).toHaveLength(WorldRegistry.all.length);
    expect(labels).toContain('World 2: Canyon Circuit. Finish every mission in Starter Island to unlock.');
    expect(labels).toContain('World 5: Sky Lab. New missions for this world are being built.');
  });
});
