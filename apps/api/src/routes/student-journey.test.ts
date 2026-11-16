import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { scoreRun } from '../domain/scoring.ts';
import { bearer, createTestContext, straightProgram, type TestContext } from '../test/harness.ts';

let t: TestContext;
let tokenC: string; // leminhc03 — fresh student
let tokenA: string; // nguyenvana01 — seeded progress
beforeAll(async () => {
  t = await createTestContext();
  [tokenC, tokenA] = await Promise.all([t.login('leminhc03'), t.login('nguyenvana01')]);
}, 60_000);
afterAll(() => t.close());

const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown, token = tokenC) =>
  t.app.inject({ method, url, headers: bearer(token), ...(payload !== undefined && { payload: payload as object }) });

const CLEAN = { objectivesCompleted: ['cp-1', 'goal', 'safe'], timeSeconds: 4, collisions: 0 };
/** Pretend the run started a while ago (the server checks simulated time against the wall clock). */
const age = (runId: string, seconds = 60) => t.db.query(`UPDATE level_attempts SET started_at = started_at - make_interval(secs => $2) WHERE id = $1`, [runId, seconds]);

describe('catalog', () => {
  test('one request: student, stats, worlds, levels with states', async () => {
    const res = await call('GET', '/api/catalog');
    expect(res.statusCode).toBe(200);
    const c = res.json();
    expect(c.student).toMatchObject({ username: 'leminhc03', displayName: 'Lê Minh C' });
    expect(c.student).not.toHaveProperty('passwordHash');
    expect(c.worlds.map((w: { slug: string }) => w.slug)).toEqual(['starter-island', 'canyon-circuit', 'frost-valley', 'jungle-ruins', 'sky-lab', 'lava-core']);
    expect(c.worlds.map((w: { order: number }) => w.order)).toEqual([1, 2, 3, 4, 5, 6]);
    const slugs = c.levels.map((l: { slug: string }) => l.slug);
    expect(slugs).not.toContain('skylab-01'); // draft
    expect(res.body).not.toMatch(/password|DATABASE_URL/i);
  });

  test('playable levels carry their content; locked ones only the card, map preview and unlock rules', async () => {
    const c = (await call('GET', '/api/catalog')).json();
    const s1 = c.levels.find((l: { slug: string }) => l.slug === 'starter-01');
    expect(s1.state).toBe('AVAILABLE');
    expect(s1.mapDefinition.start).toMatchObject({ x: -2.4, z: 0.9 });
    expect(s1.sceneConfig.path.length).toBeGreaterThan(1);
    expect(s1.content.objectives.map((o: { code: string }) => o.code)).toEqual(['cp-1', 'goal', 'safe']);
    expect(s1.content.objectives[0]).toMatchObject({ type: 'REACH_CHECKPOINT', checkpointCode: 'cp-1' });
    // Four tiers: idea, pseudocode, partial code (free) and the full solution (paid, hidden until bought).
    expect(s1.content.hints).toHaveLength(4);
    expect(s1.content.hints[2]).toMatchObject({ cost: 0 });
    expect(s1.content.hints[3]).toMatchObject({ cost: 10, revealed: false, content: null });
    expect(s1.content.missionSettings).toMatchObject({ stopInFinish: true, briefing: { tier: 'easy', mechanics: ['cargo'] } });
    expect(s1.content.allowedBlocks).toContain('motion.forward');

    const s2 = c.levels.find((l: { slug: string }) => l.slug === 'starter-02');
    expect(s2).toMatchObject({ state: 'LOCKED', lockReason: 'PREREQUISITES_NOT_MET', content: null });
    expect(s2.unlock[0].requirements[0]).toMatchObject({ type: 'LEVEL_COMPLETED', levelTitle: 'First Delivery' });
    expect(s2.mapDefinition).toBeTruthy(); // for the 3D preview
  });

  test('progress and stats come from the database', async () => {
    const c = (await call('GET', '/api/catalog', undefined, tokenA)).json();
    expect(c.stats.totalXp).toBeGreaterThan(0);
    expect(c.levels.find((l: { slug: string }) => l.slug === 'starter-01').progress).toMatchObject({ status: 'COMPLETED' });
    expect(c.lastLevelSlug).toBeTruthy();
  });

  test('staff accounts cannot use the student journey', async () => {
    const admin = await t.login('admin');
    expect((await call('GET', '/api/catalog', undefined, admin)).statusCode).toBe(403);
  });
});

describe('runs', () => {
  test('Run needs a saved program', async () => {
    const res = await call('POST', '/api/levels/starter-01/runs', {});
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PROGRAM_REQUIRED');
  });

  test('a failed run is recorded, counted, and awards nothing', async () => {
    await call('PUT', '/api/levels/starter-01/program', { blockProgram: straightProgram(120) });
    const start = await call('POST', '/api/levels/starter-01/runs', {});
    expect(start.statusCode).toBe(201);
    const run = start.json().run;
    expect(run).toMatchObject({ attemptNumber: 1, blockCount: 1 });
    const { rows } = await t.db.query<{ status: string }>('SELECT status FROM level_attempts WHERE id = $1', [run.id]);
    expect(rows[0]!.status).toBe('RUNNING');

    await age(run.id);
    const fin = await call('POST', `/api/runs/${run.id}/finish`, { outcome: 'FAILED', result: { objectivesCompleted: ['cp-1'], timeSeconds: 3, collisions: 0 } });
    expect(fin.statusCode).toBe(200);
    expect(fin.json()).toMatchObject({ passed: false, stars: 0, xpEarned: 0, run: { status: 'FAILED' } });
    expect(fin.json().objectives.find((o: { code: string }) => o.code === 'goal')).toMatchObject({ completed: false, title: expect.any(String) });
    // Already recorded.
    expect((await call('POST', `/api/runs/${run.id}/finish`, { outcome: 'FAILED', result: CLEAN })).statusCode).toBe(409);
  });

  test('simulated time cannot outrun the wall clock', async () => {
    const run = (await call('POST', '/api/levels/starter-01/runs', {})).json().run;
    const res = await call('POST', `/api/runs/${run.id}/finish`, { outcome: 'COMPLETED', result: { ...CLEAN, timeSeconds: 60 } });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('IMPLAUSIBLE_RESULT');
  });

  test('starting a new run closes the unfinished one', async () => {
    const { rows } = await t.db.query<{ status: string }>(
      `SELECT status FROM level_attempts WHERE student_id = $1 ORDER BY attempt_number`,
      [await t.userId('leminhc03')],
    );
    expect(rows.map((r) => r.status)).toEqual(['FAILED', 'RUNNING']);
    await call('POST', '/api/levels/starter-01/runs', {});
    const after = await t.db.query<{ status: string }>(`SELECT status FROM level_attempts WHERE student_id = $1 ORDER BY attempt_number`, [await t.userId('leminhc03')]);
    expect(after.rows.map((r) => r.status)).toEqual(['FAILED', 'ABORTED', 'RUNNING']);
  });

  test('a stopped run never passes, even with every objective claimed', async () => {
    const run = (await call('POST', '/api/levels/starter-01/runs', {})).json().run;
    await age(run.id);
    const res = (await call('POST', `/api/runs/${run.id}/finish`, { outcome: 'STOPPED', result: CLEAN })).json();
    expect(res).toMatchObject({ passed: false, xpEarned: 0, run: { status: 'ABORTED' } });
  });

  test('a completed run: server stars, XP once, next level unlocked, progress saved', async () => {
    await call('PUT', '/api/levels/starter-01/program', { blockProgram: straightProgram(170), createVersion: true });
    const run = (await call('POST', '/api/levels/starter-01/runs', {})).json().run;
    await age(run.id);
    const res = await call('POST', `/api/runs/${run.id}/finish`, { outcome: 'COMPLETED', result: CLEAN });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ passed: true, stars: 3, maxStars: 3, xpEarned: 50, firstCompletion: true, run: { status: 'PASSED' } });
    expect(body.objectives.every((o: { completed: boolean }) => o.completed)).toBe(true);
    expect(body.unlockedLevels).toContainEqual({ id: await t.levelId('starter-02'), slug: 'starter-02' });
    expect(body.achievementsUnlocked).toContain('first-steps');
    expect(body.stats).toMatchObject({ totalXp: 70, totalStars: 3, levelsCompleted: 1 });

    const again = (await call('POST', '/api/levels/starter-01/runs', {})).json().run;
    await age(again.id);
    const second = (await call('POST', `/api/runs/${again.id}/finish`, { outcome: 'COMPLETED', result: CLEAN })).json();
    expect(second).toMatchObject({ passed: true, xpEarned: 0, firstCompletion: false });

    const c = (await call('GET', '/api/catalog')).json();
    expect(c.levels.find((l: { slug: string }) => l.slug === 'starter-02').state).toBe('AVAILABLE');
    expect(c.levels.find((l: { slug: string }) => l.slug === 'starter-01').progress).toMatchObject({ status: 'COMPLETED', bestStars: 3, attemptCount: 6 });
    expect(c.lastLevelSlug).toBe('starter-01');
    const { rows } = await t.db.query<{ n: number }>(`SELECT count(*) AS n FROM xp_transactions WHERE student_id = $1 AND source_type = 'LEVEL_COMPLETION'`, [await t.userId('leminhc03')]);
    expect(rows[0]!.n).toBe(1);
  });

  test("students can't touch another student's run", async () => {
    await call('PUT', '/api/levels/starter-02/program', { blockProgram: straightProgram(100) }, tokenA);
    const theirs = (await call('POST', '/api/levels/starter-02/runs', {}, tokenA)).json().run;
    const res = await call('POST', `/api/runs/${theirs.id}/finish`, { outcome: 'COMPLETED', result: CLEAN });
    expect(res.statusCode).toBe(404);
  });

  test('client-sent stars or XP are refused', async () => {
    const run = (await call('POST', '/api/levels/starter-01/runs', {})).json().run;
    const res = await call('POST', `/api/runs/${run.id}/finish`, { outcome: 'COMPLETED', result: { ...CLEAN, stars: 3 }, xp: 99999 });
    expect(res.statusCode).toBe(400);
  });
});

describe('objective types the simulator cannot report', () => {
  const base = { parBlocks: null, parSeconds: null, maxStars: 3, failOnCollision: false, timeLimit: null, start: null, finish: null };
  test('START_PROGRAM is met by any run, USE_MAX_BLOCKS uses the server count, CUSTOM never blocks', () => {
    const rules = {
      ...base,
      objectives: [
        { code: 'start', type: 'START_PROGRAM', required: true, config: {}, position: null },
        { code: 'few', type: 'USE_MAX_BLOCKS', required: true, config: { count: 3 }, position: null },
        { code: 'bridge', type: 'CUSTOM', required: true, config: {}, position: null },
      ],
    };
    const report = { objectivesCompleted: [], timeSeconds: 5, collisions: 0 };
    expect(scoreRun(rules, report, 3).passed).toBe(true);
    expect(scoreRun(rules, report, 4).passed).toBe(false);
  });
});
