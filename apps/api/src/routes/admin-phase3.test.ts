import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { transitionVerb } from '../domain/workflow.ts';
import { bearer, createTestContext, PASSWORDS, type TestContext } from '../test/harness.ts';

let t: TestContext;
let admin: string;
beforeAll(async () => {
  t = await createTestContext();
  admin = await t.login('admin');
}, 60_000);
afterAll(() => t.close());

const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown, token = admin) =>
  t.app.inject({ method, url, headers: bearer(token), ...(payload !== undefined && { payload: payload as object }) });

async function roleToken(username: string, role: string) {
  await t.db.query(`INSERT INTO users (username, password_hash, display_name, role) SELECT $1, password_hash, $1, $2 FROM users WHERE username = 'admin'`, [username, role]);
  return t.login(username, PASSWORDS.admin);
}

describe('workflow rules', () => {
  test('transitions', () => {
    expect(transitionVerb('DRAFT', 'REVIEW')).toBe('REVIEW');
    expect(transitionVerb('DRAFT', 'PUBLISHED')).toBeNull();
    expect(transitionVerb('REVIEW', 'PUBLISHED')).toBe('PUBLISH');
    expect(transitionVerb('REVIEW', 'DRAFT')).toBe('REJECT');
    expect(transitionVerb('PUBLISHED', 'DRAFT')).toBe('UNPUBLISH');
    expect(transitionVerb('PUBLISHED', 'ARCHIVED')).toBe('ARCHIVE');
    expect(transitionVerb('ARCHIVED', 'DRAFT')).toBe('RESTORE');
    expect(transitionVerb('ARCHIVED', 'PUBLISHED')).toBeNull();
  });

  test('content editors can send for review but not publish', async () => {
    const editor = await roleToken('editor1', 'CONTENT_EDITOR');
    const s2 = await t.levelId('skylab-01'); // seeded draft
    expect((await call('POST', `/api/admin/levels/${s2}/status`, { status: 'REVIEW' }, editor)).statusCode).toBe(200);
    const pub = await call('POST', `/api/admin/levels/${s2}/status`, { status: 'PUBLISHED' }, editor);
    expect(pub.statusCode).toBe(403);
    // Back to draft (reject) is fine for the author.
    expect((await call('POST', `/api/admin/levels/${s2}/status`, { status: 'DRAFT' }, editor)).json().status).toBe('DRAFT');
  });

  test('curricula, worlds, lessons and achievements share the workflow', async () => {
    const { curriculums } = (await call('GET', '/api/admin/curriculums')).json();
    const c = curriculums[0];
    expect((await call('POST', `/api/admin/curriculums/${c.id}/status`, { status: 'DRAFT' })).json()).toMatchObject({ status: 'DRAFT', previousStatus: 'PUBLISHED' });
    // A draft curriculum hides its levels from students.
    const student = await t.login('nguyenvana01');
    expect((await call('GET', '/api/levels/starter-01', undefined, student)).statusCode).toBe(404);
    await call('POST', `/api/admin/curriculums/${c.id}/status`, { status: 'REVIEW' });
    expect((await call('POST', `/api/admin/curriculums/${c.id}/status`, { status: 'PUBLISHED' })).statusCode).toBe(200);
    expect((await call('GET', '/api/levels/starter-01', undefined, student)).statusCode).toBe(200);

    const lesson = (await call('GET', '/api/admin/lessons')).json().lessons[0];
    expect(lesson.curriculumName).toBeTruthy();
    expect((await call('POST', `/api/admin/lessons/${lesson.id}/status`, { status: 'ARCHIVED' })).statusCode).toBe(200);
    expect((await call('PATCH', `/api/admin/lessons/${lesson.id}`, { status: 'PUBLISHED' })).statusCode).toBe(400);
  });
});

describe('ordering', () => {
  test('hints can be reordered (unique positions survive)', async () => {
    const s1 = await t.levelId('starter-01');
    const hints = (await call('GET', `/api/admin/levels/${s1}`)).json().level.hints as { id: string }[];
    const reversed = hints.map((h) => h.id).reverse();
    expect((await call('PUT', `/api/admin/levels/${s1}/hints/order`, { ids: reversed })).statusCode).toBe(204);
    const after = (await call('GET', `/api/admin/levels/${s1}`)).json().level.hints as { id: string; sortOrder: number }[];
    expect(after.map((h) => h.id)).toEqual(reversed);
    expect(after.map((h) => h.sortOrder)).toEqual(hints.map((_, i) => i + 1));
  });

  test('a partial or foreign list is refused', async () => {
    const s1 = await t.levelId('starter-01');
    const hints = (await call('GET', `/api/admin/levels/${s1}`)).json().level.hints as { id: string }[];
    const res = await call('PUT', `/api/admin/levels/${s1}/hints/order`, { ids: [hints[0]!.id] });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('ORDER_MISMATCH');
  });

  test('levels within a world', async () => {
    const levels = (await call('GET', '/api/admin/levels?pageSize=100')).json().levels as { id: string; worldSlug: string }[];
    const starter = levels.filter((l) => l.worldSlug === 'starter-island');
    const worldId = (await call('GET', '/api/admin/worlds')).json().worlds.find((w: { slug: string }) => w.slug === 'starter-island').id;
    const ids = starter.map((l) => l.id).reverse();
    expect((await call('PUT', '/api/admin/levels/order', { worldId, ids })).statusCode).toBe(204);
    const again = (await call('GET', `/api/admin/levels?worldId=${worldId}`)).json().levels as { id: string }[];
    expect(again.map((l) => l.id)).toEqual(ids);
    await call('PUT', '/api/admin/levels/order', { worldId, ids: [...ids].reverse() });
  });
});

describe('levels overview', () => {
  test('list includes stats and readable unlock rules', async () => {
    const levels = (await call('GET', '/api/admin/levels?pageSize=100')).json().levels;
    const s2 = levels.find((l: { slug: string }) => l.slug === 'starter-02');
    expect(s2).toMatchObject({ worldName: 'Starter Island', studentsCompleted: 1 });
    expect(s2.attempts).toBeGreaterThan(0);
    expect(s2.prerequisites[0].requirements[0]).toMatchObject({ type: 'LEVEL_COMPLETED', levelSlug: 'starter-01', levelTitle: 'First Delivery' });
  });

  test('graph is available to teachers (for pickers), full CRUD is not', async () => {
    const teacher = await roleToken('teacher2', 'TEACHER');
    const graph = await call('GET', '/api/admin/levels/graph', undefined, teacher);
    expect(graph.statusCode).toBe(200);
    expect(graph.json().levels.length).toBe(31); // 29 published + 2 drafts
    expect((await call('GET', '/api/admin/levels', undefined, teacher)).statusCode).toBe(403);
  });

  test('per-level student overrides', async () => {
    const c = await t.userId('leminhc03');
    await call('POST', `/api/admin/students/${c}/levels/starter-03/unlock`, { reason: 'Extra practice' });
    const s3 = await t.levelId('starter-03');
    const res = (await call('GET', `/api/admin/levels/${s3}/access`)).json();
    expect(res.overrides).toEqual([expect.objectContaining({ username: 'leminhc03', status: 'AVAILABLE', reason: 'Extra practice', grantedBy: 'OneRoboLab Administrator' })]);
  });
});

describe('dashboard, analytics, activity', () => {
  test('dashboard numbers and feed', async () => {
    const res = await call('GET', '/api/admin/dashboard');
    expect(res.statusCode).toBe(200);
    const { totals, attemptsByDay, recentActivity } = res.json();
    expect(totals).toMatchObject({ totalStudents: 3, levelsPublished: 29 });
    expect(totals.levelsCompleted).toBeGreaterThan(0);
    expect(totals.completionRate).toBeGreaterThan(0);
    expect(attemptsByDay).toHaveLength(14);
    const types = recentActivity.map((a: { type: string }) => a.type);
    expect(types).toContain('LEVEL_COMPLETED');
    expect(types).toContain('UNLOCK_LEVEL');
    const unlock = recentActivity.find((a: { type: string }) => a.type === 'UNLOCK_LEVEL');
    expect(unlock).toMatchObject({ studentName: 'Lê Minh C', levelTitle: expect.any(String) });
  });

  test('analytics', async () => {
    const res = (await call('GET', '/api/admin/statistics?days=14')).json();
    expect(res.daily).toHaveLength(14);
    expect(res.worlds.length).toBeGreaterThan(0);
    expect(res.starDistribution).toHaveLength(6);
    expect(res.levels[0]).toHaveProperty('avgAttempts');
  });

  test('attempts across students, with the exact program that ran', async () => {
    const list = (await call('GET', '/api/admin/attempts?pageSize=5')).json();
    expect(list.total).toBeGreaterThan(0);
    const first = list.attempts[0];
    expect(first).toMatchObject({ studentName: expect.any(String), levelTitle: expect.any(String) });
    const detail = (await call('GET', `/api/admin/attempts/${first.id}`)).json();
    expect(detail.objectives.length).toBeGreaterThan(0);
    if (first.programVersionId) expect(detail.programVersion.blockProgram.format).toBe('roboverse.blocks');
    const filtered = (await call('GET', `/api/admin/attempts?status=PASSED&search=nguyen`)).json();
    expect(filtered.attempts.every((a: { status: string; username: string }) => a.status === 'PASSED' && a.username.includes('nguyen'))).toBe(true);
  });

  test('programs across students', async () => {
    const res = (await call('GET', '/api/admin/programs?search=first')).json();
    expect(res.programs.length).toBeGreaterThan(0);
    expect(res.programs[0]).toMatchObject({ levelTitle: 'First Delivery' });
    expect(res.programs[0]).not.toHaveProperty('blockProgram');
  });

  test('students sort by XP and show last activity', async () => {
    const res = (await call('GET', '/api/admin/students?sort=xp')).json();
    const xp = res.students.map((s: { totalXp: number }) => s.totalXp);
    expect(xp).toEqual([...xp].sort((a, b) => b - a));
    expect(res.students[0].lastActivityAt).not.toBeNull();
  });

  test('audit log is readable and filterable', async () => {
    const res = (await call('GET', '/api/admin/audit-logs?action=UNLOCK_LEVEL')).json();
    expect(res.total).toBeGreaterThan(0);
    expect(res.logs[0]).toMatchObject({ adminName: 'OneRoboLab Administrator', studentName: 'Lê Minh C', levelTitle: expect.any(String) });
    // “Today” as the database sees it (its session time zone decides date filters).
    const today = (await t.db.query<{ d: string }>('SELECT CURRENT_DATE::text AS d')).rows[0]!.d;
    const dated = (await call('GET', `/api/admin/audit-logs?from=${today}&to=${today}`)).json();
    expect(dated.logs.length).toBeGreaterThan(0);
    const none = (await call('GET', '/api/admin/audit-logs?from=2000-01-01&to=2000-01-02')).json();
    expect(none.total).toBe(0);
  });

  test('students cannot reach any of it', async () => {
    const student = await t.login('tranthib02');
    for (const url of ['/api/admin/dashboard', '/api/admin/statistics', '/api/admin/attempts', '/api/admin/programs', '/api/admin/levels/graph']) {
      expect((await call('GET', url, undefined, student)).statusCode, url).toBe(403);
    }
  });
});
