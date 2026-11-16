import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bearer, createTestContext, straightProgram, type TestContext } from '../test/harness.ts';

let t: TestContext;
let tokenC: string; // leminhc03 — fresh student
let tokenA: string; // nguyenvana01 — seeded progress
beforeAll(async () => {
  t = await createTestContext();
  [tokenC, tokenA] = await Promise.all([t.login('leminhc03'), t.login('nguyenvana01')]);
}, 60_000);
afterAll(() => t.close());

const get = (url: string, token = tokenC) => t.app.inject({ method: 'GET', url, headers: bearer(token) });
const send = (method: 'POST' | 'PUT', url: string, payload: unknown, token = tokenC) =>
  t.app.inject({ method, url, headers: bearer(token), payload: payload as object });

const CLEAN_RUN = { objectivesCompleted: ['cp-1', 'goal', 'safe'], timeSeconds: 4, collisions: 0 };

describe('curriculum & level access', () => {
  test('curriculum lists only published content with server-computed states', async () => {
    const res = await get('/api/curriculum');
    expect(res.statusCode).toBe(200);
    const levels = res.json().curricula.flatMap((c: { worlds: { levels: { slug: string; state: string }[] }[] }) => c.worlds.flatMap((w) => w.levels));
    const state = Object.fromEntries(levels.map((l: { slug: string; state: string }) => [l.slug, l.state]));
    expect(state['starter-01']).toBe('AVAILABLE');
    expect(state['starter-02']).toBe('LOCKED');
    expect(state['skylab-01']).toBeUndefined(); // draft
  });

  test('a locked level shows its card but not its content; drafts are 404', async () => {
    const locked = await get('/api/levels/starter-02');
    expect(locked.statusCode).toBe(200);
    expect(locked.json().level).toMatchObject({ state: 'LOCKED', lockReason: 'PREREQUISITES_NOT_MET' });
    expect(locked.json().level.mapDefinition).toBeUndefined();
    expect((await get('/api/levels/skylab-01')).statusCode).toBe(404);
    expect((await get('/api/levels/00000000-0000-0000-0000-000000000000')).statusCode).toBe(404);
  });

  test('paid hints stay hidden until revealed', async () => {
    const level = (await get('/api/levels/starter-01')).json().level;
    expect(level.mapDefinition.start).toBeDefined();
    const paid = level.hints.find((h: { cost: number }) => h.cost > 0);
    expect(paid.content).toBeNull();
    // Student C has 0 XP → cannot afford it.
    const res = await send('POST', `/api/levels/starter-01/hints/${paid.id}/reveal`, {});
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('NOT_ENOUGH_XP');
  });

  test('a locked level cannot be saved, run or submitted', async () => {
    const save = await send('PUT', '/api/levels/starter-02/program', { blockProgram: straightProgram(100) });
    expect(save.statusCode).toBe(403);
    expect(save.json().error).toMatchObject({ code: 'LEVEL_LOCKED', details: { state: 'LOCKED' } });
    expect((await send('POST', '/api/levels/starter-02/submissions', { result: CLEAN_RUN })).statusCode).toBe(403);
  });
});

describe('programs', () => {
  test('invalid, disallowed and malicious programs are rejected', async () => {
    const notProgram = await send('PUT', '/api/levels/starter-01/program', { blockProgram: { hello: 'world' } });
    expect(notProgram.statusCode).toBe(422);
    expect(notProgram.json().error.code).toBe('PROGRAM_INVALID');

    // starter-01 allows only moving, turning and stopping (no speed block yet).
    const disallowed = await send('PUT', '/api/levels/starter-01/program', { blockProgram: straightProgram(100, [{ type: 'motion.speed', fields: { speed: 80 } }]) });
    expect(disallowed.statusCode).toBe(422);
    expect(disallowed.json().error).toMatchObject({ code: 'BLOCK_NOT_ALLOWED', details: { blocks: ['motion.speed'] } });

    const tooBig = await send('PUT', '/api/levels/starter-01/program', { blockProgram: { ...straightProgram(1), pad: 'x'.repeat(250_000) } });
    expect(tooBig.statusCode).toBe(422);
    expect(tooBig.json().error.code).toBe('PROGRAM_TOO_LARGE');
  });

  test('submitting before saving is a 409', async () => {
    const res = await send('POST', '/api/levels/starter-01/submissions', { result: CLEAN_RUN });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PROGRAM_REQUIRED');
  });

  test('save and load the program', async () => {
    const saved = await send('PUT', '/api/levels/starter-01/program', { blockProgram: straightProgram(170), createVersion: true });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().program).toMatchObject({ name: 'Main', version: 1 });
    const loaded = await get('/api/levels/starter-01/program');
    expect(loaded.json().program.blockProgram.blocks.b1.fields.distance).toBe(170);
    // Another student sees only their own program.
    const other = (await get('/api/levels/starter-01/program', tokenA)).json().program;
    expect(other.id).not.toBe(saved.json().program.id);
  });
});

describe('runs, scoring and rewards', () => {
  test('client-sent stars / score / XP are not accepted', async () => {
    const res = await send('POST', '/api/levels/starter-01/submissions', { result: { ...CLEAN_RUN, stars: 3 }, xp: 99999 });
    expect(res.statusCode).toBe(400);
  });

  test('impossible results are rejected', async () => {
    const fast = await send('POST', '/api/levels/starter-01/submissions', { result: { ...CLEAN_RUN, timeSeconds: 0.2 } });
    expect(fast.statusCode).toBe(422);
    expect(fast.json().error.code).toBe('IMPLAUSIBLE_RESULT');
    const unknown = await send('POST', '/api/levels/starter-01/submissions', { result: { ...CLEAN_RUN, objectivesCompleted: ['goal', 'secret-bonus'] } });
    expect(unknown.statusCode).toBe(422);
  });

  test('a failed attempt is recorded and numbered, but awards nothing', async () => {
    const res = await send('POST', '/api/levels/starter-01/attempts', { status: 'PASSED', result: { ...CLEAN_RUN, collisions: 2 } });
    expect(res.statusCode).toBe(201);
    // Server overrides the claimed PASSED.
    expect(res.json().attempt).toMatchObject({ status: 'FAILED', attemptNumber: 1, stars: 0 });
    const second = await send('POST', '/api/levels/starter-01/attempts', { status: 'ABORTED', result: { objectivesCompleted: [], timeSeconds: 1, collisions: 0 } });
    expect(second.json().attempt.attemptNumber).toBe(2);
  });

  test('a clean submission completes the level: stars, XP once, unlocks the next level', async () => {
    const res = await send('POST', '/api/levels/starter-01/submissions', { result: CLEAN_RUN });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    // 500 complete + 100 checkpoint + 200 time bonus + 200 efficiency bonus (mission_settings.scoring).
    expect(body.submission).toMatchObject({ status: 'PASSED', stars: 3, score: 1000, xpEarned: 50, blockCount: 1 });
    expect(body.achievementsUnlocked).toContain('first-steps');
    expect(body.unlockedLevels).toContain(await t.levelId('starter-02'));
    expect(body.stats).toMatchObject({ totalStars: 3, levelsCompleted: 1, totalXp: 50 + 20 });

    const again = (await send('POST', '/api/levels/starter-01/submissions', { result: CLEAN_RUN })).json();
    expect(again.submission.xpEarned).toBe(0);
    expect(again.stats.totalXp).toBe(70);
    expect(again.stats.totalStars).toBe(3);

    expect((await get('/api/levels/starter-02')).json().level.state).toBe('AVAILABLE');
    const progress = (await get('/api/me/progress')).json();
    expect(progress.stats).toMatchObject({ totalXp: 70, totalStars: 3, levelsCompleted: 1, currentStreak: 1 });
    const ach = (await get('/api/me/achievements')).json().achievements;
    expect(ach.find((a: { slug: string }) => a.slug === 'first-steps').unlockedAt).not.toBeNull();
  });

  test('a paid hint can be bought once XP is available', async () => {
    const level = (await get('/api/levels/starter-01')).json().level;
    const paid = level.hints.find((h: { cost: number }) => h.cost > 0);
    const res = await send('POST', `/api/levels/starter-01/hints/${paid.id}/reveal`, {});
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().hint.content).toContain('move forward 120 cm');
    await send('POST', `/api/levels/starter-01/hints/${paid.id}/reveal`, {}); // idempotent
    expect((await get('/api/me/progress')).json().stats.totalXp).toBe(60);
  });
});

describe('isolation & RBAC', () => {
  test('students cannot call admin endpoints', async () => {
    const id = await t.userId('nguyenvana01');
    for (const url of ['/api/admin/students', `/api/admin/students/${id}/programs`, '/api/admin/levels', '/api/admin/audit-logs']) {
      const res = await get(url);
      expect(res.statusCode, url).toBe(403);
    }
    const unlock = await send('POST', `/api/admin/students/${await t.userId('leminhc03')}/levels/starter-03/unlock`, {});
    expect(unlock.statusCode).toBe(403);
  });

  test('admins cannot use student-only routes (no student data by accident)', async () => {
    const admin = await t.login('admin');
    expect((await get('/api/me/progress', admin)).statusCode).toBe(403);
  });

  test("a student's progress shows only their own data", async () => {
    const a = (await get('/api/me/progress', tokenA)).json();
    const c = (await get('/api/me/progress', tokenC)).json();
    expect(a.stats.totalXp).not.toBe(c.stats.totalXp);
    expect(c.levels.map((l: { slug: string }) => l.slug)).toEqual(['starter-01']);
  });
});
