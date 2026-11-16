import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVELS } from '../../content/levels/registry';
import type { LevelDefinition } from '../../content/levels/types';
import { WORLDS } from '../../content/worlds/registry';
import { ApiError } from '../api/client';
import { useConnectionStore } from '../api/connection-store';
import { LoginPage } from '../account/LoginPage';
import type { ApiLevel, ApiWorld, Catalog, RunFinish } from '../account/student-api';
import { lockMessage } from '../levels/lock-reason';
import { levelStatus, ServerProgressStore } from '../levels/progress';
import { decideProgram } from '../programming/state/program-sync';
import { playerStats } from '../world-map/world-progress';
import { buildCatalog, levelFromApi, toMap } from './from-api';
import { missionSettingsOf } from './mission-settings';
import { objectiveToRow } from './objective-codec';

/** Server-render to HTML without React's text separators. */
const html = (el: ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

// ── API fixtures, built exactly the way database/seed.sql exports the bundled content ──
const DIFF = ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;

function apiLevel(level: LevelDefinition, state: ApiLevel['state'] = 'AVAILABLE', extra: Partial<ApiLevel> = {}): ApiLevel {
  const playable = state !== 'LOCKED' && state !== 'DISABLED';
  return {
    id: `uuid-${level.id}`,
    slug: level.id,
    worldId: `uuid-${level.world}`,
    worldSlug: level.world,
    title: level.title,
    briefDescription: level.description,
    description: `${level.description} Environment: …`,
    difficulty: DIFF[level.difficulty - 1]!,
    sortOrder: level.number,
    environmentId: level.environmentId,
    xpReward: level.rewards.xp,
    maxStars: 3,
    parBlocks: level.stars.parBlocks ?? null,
    parSeconds: level.stars.parSeconds ?? null,
    estimatedMinutes: 10,
    contentVersion: 1,
    mapDefinition: JSON.parse(JSON.stringify(level.map)) as Record<string, unknown>,
    sceneConfig: JSON.parse(JSON.stringify(level.scene)) as Record<string, unknown>,
    state,
    lockReason: playable ? null : 'PREREQUISITES_NOT_MET',
    unlock: playable ? null : [],
    progress: null,
    content: playable
      ? {
          allowedBlocks: level.allowedBlocks === 'all' ? null : level.allowedBlocks,
          introSteps: level.intro,
          missionSettings: { ...missionSettingsOf(level) },
          objectives: level.mission.objectives.map((o) => ({ code: o.id, title: o.label ?? o.id, description: null, ...objectiveToRow(o) })),
          // Like the seed: the last hint costs 10 XP and stays hidden until bought.
          hints: level.hints.map((h, i) => ({ id: `hint-${i}`, title: `Hint ${i + 1}`, cost: i === level.hints.length - 1 ? 10 : 0, revealed: false, content: i === level.hints.length - 1 ? null : h })),
        }
      : null,
    ...extra,
  };
}

const apiWorld = (i: number): ApiWorld => {
  const w = WORLDS[i]!;
  return { id: `uuid-${w.id}`, slug: w.id, name: w.name, shortDescription: w.tagline, description: w.description, theme: w.theme, accentColor: w.color, skills: w.skills, difficulty: DIFF[w.difficulty - 1]!, mapPosition: w.mapPosition, curriculumName: 'Robotics Foundations', order: w.order };
};

const catalog = (levels: ApiLevel[], stats = { totalXp: 0, totalStars: 0, levelsCompleted: 0, currentStreak: 0 }): Catalog => ({
  student: { id: 's1', username: 'leminhc03', displayName: 'Lê Minh C', avatarUrl: null },
  stats,
  lastLevelSlug: null,
  worlds: WORLDS.map((_, i) => apiWorld(i)),
  levels,
});

const byId = (id: string) => LEVELS.find((l) => l.id === id)!;

describe('API content → app content', () => {
  it('every bundled level survives the database round trip (map, scene, mission, blocks, stars, XP)', () => {
    for (const level of LEVELS) {
      const built = levelFromApi(apiLevel(level), level.number)!;
      expect(built, level.id).not.toBeNull();
      expect(built.map, level.id).toEqual(level.map);
      expect(built.scene, level.id).toEqual(level.scene);
      expect(built.environmentId).toBe(level.environmentId);
      expect(built.briefing, level.id).toEqual(level.briefing);
      expect(built.mission.scoring, level.id).toEqual(level.mission.scoring);
      expect(built.mission.stopInFinish ?? false, level.id).toBe(level.mission.stopInFinish ?? false);
      expect(built.mission.objectives, level.id).toEqual(level.mission.objectives.map((o) => ({ ...o, label: o.label ?? o.id })));
      expect(built.mission.orderedCheckpoints ?? false, level.id).toBe(level.mission.orderedCheckpoints ?? false);
      expect([built.data, built.variants, built.editor, built.fog], level.id).toEqual([level.data, level.variants, level.editor, level.fog]);
      expect(built.mission.objectives.filter((o) => o.type === 'reachCheckpoint').map((o) => o.type === 'reachCheckpoint' && o.checkpointId)).toEqual(
        level.mission.objectives.filter((o) => o.type === 'reachCheckpoint').map((o) => o.type === 'reachCheckpoint' && o.checkpointId),
      );
      expect([built.mission.failOnCollision, built.mission.timeLimit, built.mission.title]).toEqual([level.mission.failOnCollision, level.mission.timeLimit, level.mission.title]);
      expect(built.allowedBlocks).toEqual(level.allowedBlocks);
      expect(built.intro).toEqual(level.intro);
      expect(built.stars).toEqual(level.stars);
      expect(built.rewards).toEqual(level.rewards);
      expect(built.difficulty).toBe(level.difficulty);
      // Free hints come with their text, the paid one stays hidden.
      expect(built.hints.slice(0, -1)).toEqual(level.hints.slice(0, -1));
      expect(built.hints[built.hints.length - 1]).toBe('');
      expect(built.server?.hints[built.hints.length - 1]).toMatchObject({ cost: 10, revealed: false });
    }
  });

  it('refuses what this app build cannot render instead of half-building it', () => {
    const s1 = LEVELS[0]!;
    expect(levelFromApi(apiLevel(s1, 'AVAILABLE', { environmentId: 'moon-base' }), 1)).toBeNull();
    expect(levelFromApi(apiLevel(s1, 'AVAILABLE', { mapDefinition: {} }), 1)).toBeNull();
    expect(toMap({ size: { x: 4, z: 4 }, start: { x: 0, z: 0 }, finish: { center: { x: 1, z: 0 } }, entities: [] }, 'x')).toMatchObject({ gridSize: 0.5, start: { heading: 0 } });
  });

  it('locked levels carry their card and map preview, but are not playable', () => {
    const locked = levelFromApi(apiLevel(LEVELS[1]!, 'LOCKED'), 2, LEVELS[1])!;
    expect(locked.server?.playable).toBe(false);
    expect(locked.hints).toEqual([]);
    expect(locked.map).toEqual(LEVELS[1]!.map);
  });
});

describe('catalog', () => {
  const built = buildCatalog(
    catalog([
      apiLevel(LEVELS[0]!, 'COMPLETED', { progress: { status: 'COMPLETED', bestStars: 3, bestScore: 800, bestTimeSeconds: 4, attemptCount: 2, completedAt: '2026-09-29T10:00:00Z', lastAttemptAt: '2026-09-29T10:00:00Z' } }),
      apiLevel(LEVELS[1]!, 'AVAILABLE'),
      apiLevel(LEVELS[2]!, 'LOCKED', { unlock: [{ requirements: [{ type: 'LEVEL_COMPLETED', levelSlug: 'starter-02', levelTitle: 'Turn the Corner' }] }] }),
      apiLevel(byId('canyon-01'), 'LOCKED', { unlock: [{ requirements: [{ type: 'WORLD_COMPLETED', worldName: 'Starter Island' }] }, { requirements: [{ type: 'TOTAL_STARS', stars: 15 }] }] }),
      apiLevel(byId('canyon-02'), 'LOCKED', { environmentId: 'unknown-env' }),
    ], { totalXp: 320, totalStars: 8, levelsCompleted: 3, currentStreak: 2 }),
    { levels: LEVELS, worlds: WORLDS },
  );
  const p = built.progress;

  it('worlds and levels in journey order, numbered per world; unknown ones reported', () => {
    expect(built.worlds.map((w) => w.id)).toEqual(WORLDS.map((w) => w.id));
    expect(built.levels.map((l) => `${l.world}:${l.number}`)).toEqual(['starter-island:1', 'starter-island:2', 'starter-island:3', 'canyon-circuit:1']);
    expect(built.skipped).toEqual(['canyon-02']);
  });

  it('states come from the server, never from local rules', () => {
    const order = built.levels.map((l) => l.id);
    expect(order.map((id) => levelStatus(id, order, p))).toEqual(['completed', 'available', 'locked', 'locked']);
    expect(levelStatus('not-in-catalog', order, p)).toBe('locked');
  });

  it('totals are the server’s (XP ledger), not recomputed from rewards', () => {
    expect(playerStats(p, new Date())).toMatchObject({ xp: 320, stars: 8, missionsCompleted: 3, streak: 2 });
  });

  it('lock messages name what is missing', () => {
    expect(lockMessage('starter-03', p)).toBe('Complete Turn the Corner to unlock this mission.');
    // Two alternative rules: the closer one is shown.
    expect(lockMessage('canyon-01', p)).toBe('Finish every mission in Starter Island to unlock this mission.');
    expect(lockMessage('starter-02', p)).toBeNull();
    const byTeacher = { ...p, server: { ...p.server!, states: { ...p.server!.states, 'starter-03': { status: 'locked' as const, lockReason: 'LOCKED_BY_ADMIN', unlock: [] } } } };
    expect(lockMessage('starter-03', byTeacher)).toContain('teacher');
  });

  it('a saved run updates stars, unlocks and totals at once', () => {
    const store = new ServerProgressStore(p);
    store.recordAttempt('starter-02');
    expect(store.getProgress().server!.states['starter-02']!.status).toBe('in_progress');
    const after = store.applyRun('starter-02', { passed: true, stars: 3, unlockedLevels: [{ slug: 'starter-03' }], stats: { totalXp: 395, totalStars: 11, levelsCompleted: 4, currentStreak: 2 } }, 12);
    expect(after.levels['starter-02']).toMatchObject({ completed: true, bestStars: 3, attempts: 1 });
    expect(after.server!.states['starter-03']!.status).toBe('available');
    expect(playerStats(after, new Date())).toMatchObject({ xp: 395, stars: 11, missionsCompleted: 4 });
    expect(store.resetProgress()).toBe(after); // the browser can't reset server progress
  });
});

describe('program sync decisions', () => {
  const server = { updatedAt: '2026-09-29T10:00:00.000Z' };
  it('server copy unless the local one has newer, unsynced edits based on it', () => {
    expect(decideProgram({ exists: false, meta: undefined }, server)).toBe('use-server');
    expect(decideProgram({ exists: true, meta: { dirty: false, base: server.updatedAt } }, server)).toBe('use-server');
    expect(decideProgram({ exists: true, meta: { dirty: true, base: server.updatedAt } }, server)).toBe('push-local');
    // Changed elsewhere since: the server wins (local kept as a backup).
    expect(decideProgram({ exists: true, meta: { dirty: true, base: '2026-09-28T00:00:00.000Z' } }, server)).toBe('server-wins-conflict');
    expect(decideProgram({ exists: true, meta: { dirty: true, base: null } }, null)).toBe('push-local');
    expect(decideProgram({ exists: false, meta: undefined }, null)).toBe('keep-local');
  });
});

// ── run session: server verdict, offline retry ──────────────────────────
const api = vi.hoisted(() => ({ startRun: vi.fn(), finishRun: vi.fn() }));
vi.mock('../account/student-api', async (orig) => {
  const real = await orig<typeof import('../account/student-api')>();
  return { ...real, studentApi: { ...real.studentApi, startRun: api.startRun, finishRun: api.finishRun } };
});
vi.mock('../programming/state/program-sync', async (orig) => {
  const real = await orig<typeof import('../programming/state/program-sync')>();
  return { ...real, flushProgram: vi.fn(async () => true) };
});

describe('run session', () => {
  const finish: RunFinish = {
    run: { id: 'r1', attemptNumber: 1, status: 'PASSED' },
    passed: true,
    stars: 3,
    maxStars: 3,
    score: 800,
    xpEarned: 50,
    newBest: true,
    firstCompletion: true,
    blockCount: 1,
    criteria: [],
    reasons: [],
    objectives: [],
    achievementsUnlocked: [],
    unlockedLevels: [],
    stats: null,
  };
  const report = { objectivesCompleted: ['goal'], timeSeconds: 4, collisions: 0 };
  beforeEach(() => {
    api.startRun.mockReset().mockResolvedValue({ run: { id: 'r1', attemptNumber: 1, startedAt: '', blockCount: 1 } });
    api.finishRun.mockReset();
    useConnectionStore.setState({ online: true, lostAt: null });
  });
  afterEach(async () => (await import('../levels/run-session')).resetRunSession());

  it('Run registers an attempt; the end sends what happened and returns the server verdict', async () => {
    const { beginRun, endRun } = await import('../levels/run-session');
    api.finishRun.mockResolvedValue(finish);
    beginRun('starter-01');
    const res = await endRun('COMPLETED', report);
    expect(api.startRun).toHaveBeenCalledWith('starter-01');
    expect(api.finishRun).toHaveBeenCalledWith('r1', 'COMPLETED', report);
    expect(res).toMatchObject({ kind: 'saved', finish: { xpEarned: 50 } });
    // A run finishes once.
    expect((await endRun('COMPLETED', report)).kind).toBe('unsaved');
  });

  it('connection lost: the finish is retried when the server is back', async () => {
    const { beginRun, endRun } = await import('../levels/run-session');
    api.finishRun.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline')).mockResolvedValueOnce(finish);
    beginRun('starter-01');
    const res = await endRun('COMPLETED', report);
    expect(res.kind).toBe('offline');
    useConnectionStore.getState().setOnline(false);
    useConnectionStore.getState().setOnline(true);
    await expect(res.kind === 'offline' ? res.retry : null).resolves.toMatchObject({ passed: true });
    expect(api.finishRun).toHaveBeenCalledTimes(2);
  });

  it('a run the server never registered is reported as not saved', async () => {
    const { beginRun, endRun } = await import('../levels/run-session');
    api.startRun.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    beginRun('starter-01');
    const res = await endRun('COMPLETED', report);
    expect(res).toMatchObject({ kind: 'unsaved', message: expect.stringContaining('Connection lost') });
    expect(api.finishRun).not.toHaveBeenCalled();
  });
});

describe('sign-in page', () => {
  it('username + password only (no email, no phone)', () => {
    const page = html(<LoginPage />);
    expect(page).toContain('Username');
    expect(page).toContain('Password');
    expect(page).toContain('Keep me signed in on this device');
    expect(page.toLowerCase()).not.toContain('email');
    expect(page.toLowerCase()).not.toContain('phone');
  });
});
