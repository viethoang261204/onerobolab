import { afterAll, beforeAll, describe, expect, test } from 'vitest';
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

async function auditActions(entityId: string) {
  const { rows } = await t.db.query<{ action: string }>('SELECT action FROM audit_logs WHERE entity_id = $1 ORDER BY created_at, id', [entityId]);
  return rows.map((r) => r.action);
}

describe('students', () => {
  let studentId = '';

  test('create a student (hash stored, never returned, audited)', async () => {
    const res = await call('POST', '/api/admin/students', { username: 'phamd04', displayName: 'Phạm D', password: 'First-Pass-2026', classLabel: '6A' });
    expect(res.statusCode).toBe(201);
    expect(res.body).not.toMatch(/passwordHash|password_hash|argon2|First-Pass-2026/);
    studentId = res.json().student.id;
    expect(res.json().student).toMatchObject({ username: 'phamd04', classLabel: '6A', mustChangePassword: true, status: 'ACTIVE' });
    const { rows } = await t.db.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [studentId]);
    expect(rows[0]!.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(await auditActions(studentId)).toEqual(['CREATE_STUDENT']);
    const { rows: logs } = await t.db.query<{ new_data: unknown }>('SELECT new_data FROM audit_logs WHERE entity_id = $1', [studentId]);
    expect(JSON.stringify(logs)).not.toContain('First-Pass-2026');
  });

  test('duplicate usernames (any case) are 409; bad input is 400', async () => {
    const dup = await call('POST', '/api/admin/students', { username: 'PhamD04', displayName: 'X', password: 'Another-Pass-1' });
    expect(dup.statusCode).toBe(409);
    const bad = await call('POST', '/api/admin/students', { username: 'a b', displayName: '', password: '1' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('VALIDATION_FAILED');
  });

  test('list and search never include password hashes', async () => {
    const res = await call('GET', '/api/admin/students?search=pham');
    expect(res.statusCode).toBe(200);
    expect(res.json().students.map((s: { username: string }) => s.username)).toEqual(['phamd04']);
    const all = await call('GET', '/api/admin/students?pageSize=100');
    expect(all.body).not.toMatch(/password_hash|passwordHash|argon2/);
    expect(all.json().total).toBe(4);
  });

  test('disabling signs the student out everywhere', async () => {
    const token = await t.login('phamd04', 'First-Pass-2026');
    const res = await call('PATCH', `/api/admin/students/${studentId}`, { status: 'DISABLED' });
    expect(res.statusCode).toBe(200);
    expect((await call('GET', '/api/auth/me', undefined, token)).statusCode).toBe(401);
    expect(await auditActions(studentId)).toContain('DISABLE_STUDENT');
    await call('PATCH', `/api/admin/students/${studentId}`, { status: 'ACTIVE' });
    expect(await auditActions(studentId)).toContain('ENABLE_STUDENT');
  });

  test('reset password revokes sessions and forces a change', async () => {
    const token = await t.login('phamd04', 'First-Pass-2026');
    const res = await call('POST', `/api/admin/students/${studentId}/reset-password`, { newPassword: 'Reset-Pass-2026' });
    expect(res.statusCode).toBe(204);
    expect((await call('GET', '/api/auth/me', undefined, token)).statusCode).toBe(401);
    const fresh = await t.login('phamd04', 'Reset-Pass-2026');
    expect((await call('GET', '/api/curriculum', undefined, fresh)).json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect(await auditActions(studentId)).toContain('RESET_PASSWORD');
  });

  test('admins cannot be edited through the student API', async () => {
    const adminId = await t.userId('admin');
    expect((await call('PATCH', `/api/admin/students/${adminId}`, { status: 'DISABLED' })).statusCode).toBe(404);
    expect((await call('POST', `/api/admin/students/${adminId}/reset-password`, { newPassword: 'Hijack-Pass-2026' })).statusCode).toBe(404);
  });

  test('reports: progress, attempts, programs', async () => {
    const a = await t.userId('nguyenvana01');
    const progress = (await call('GET', `/api/admin/students/${a}/progress`)).json();
    const s1 = progress.levels.find((l: { slug: string }) => l.slug === 'starter-01');
    expect(s1).toMatchObject({ state: 'COMPLETED', progressStatus: 'COMPLETED' });
    expect((await call('GET', `/api/admin/students/${a}/attempts`)).json().attempts.length).toBeGreaterThan(0);
    const programs = (await call('GET', `/api/admin/students/${a}/programs`)).json().programs;
    expect(programs.length).toBeGreaterThan(0);
    const detail = await call('GET', `/api/admin/programs/${programs[0].id}`);
    expect(detail.json().versions.length).toBeGreaterThan(0);
  });
});

describe('per-student level access', () => {
  test('unlock / lock / clear change what the student can do, with audit', async () => {
    const c = await t.userId('leminhc03');
    const student = await t.login('leminhc03');
    const state = async () => (await call('GET', '/api/levels/starter-03', undefined, student)).json().level.state;
    expect(await state()).toBe('LOCKED');

    const unlock = await call('POST', `/api/admin/students/${c}/levels/starter-03/unlock`, { reason: 'Catching up after absence' });
    expect(unlock.statusCode).toBe(200);
    expect(unlock.json().access.effectiveState.state).toBe('AVAILABLE');
    expect(await state()).toBe('AVAILABLE');

    await call('POST', `/api/admin/students/${c}/levels/starter-03/lock`, {});
    expect(await state()).toBe('LOCKED');
    const levelId = await t.levelId('starter-03');
    expect(await auditActions(`${c}:${levelId}`)).toEqual(['UNLOCK_LEVEL', 'LOCK_LEVEL']);

    expect((await call('DELETE', `/api/admin/students/${c}/levels/starter-03/access`)).statusCode).toBe(200);
    expect(await state()).toBe('LOCKED'); // back to prerequisites
    expect(await auditActions(`${c}:${levelId}`)).toContain('CLEAR_LEVEL_ACCESS');
  });

  test('past expiry dates are rejected', async () => {
    const c = await t.userId('leminhc03');
    const res = await call('POST', `/api/admin/students/${c}/levels/starter-03/unlock`, { expiresAt: '2000-01-01T00:00:00Z' });
    expect(res.statusCode).toBe(422);
  });
});

describe('curriculum & levels', () => {
  let levelId = '';

  test('create curriculum + world + draft level (audited)', async () => {
    const cur = await call('POST', '/api/admin/curriculums', { name: 'Test Track', slug: 'test-track' });
    expect(cur.statusCode).toBe(201);
    const world = await call('POST', '/api/admin/worlds', { curriculumId: cur.json().curriculum.id, name: 'Test World', slug: 'test-world', theme: 'starter' });
    expect(world.statusCode).toBe(201);
    expect(world.json().world.status).toBe('DRAFT');
    // Status is never set through create / PATCH — only the workflow.
    expect((await call('PATCH', `/api/admin/worlds/${world.json().world.id}`, { status: 'PUBLISHED' })).statusCode).toBe(400);
    const level = await call('POST', '/api/admin/levels', { worldId: world.json().world.id, slug: 'test-01', title: 'Test 01', environmentId: 'starter-courtyard' });
    expect(level.statusCode).toBe(201);
    expect(level.json().level.status).toBe('DRAFT');
    levelId = level.json().level.id;
    expect(await auditActions(levelId)).toEqual(['CREATE_LEVEL']);

    // Status can't be set on create.
    expect((await call('POST', '/api/admin/levels', { worldId: world.json().world.id, slug: 'test-02', title: 'T', environmentId: 'starter-courtyard', status: 'PUBLISHED' })).statusCode).toBe(400);
    // Unknown environment → 422.
    expect((await call('POST', '/api/admin/levels', { worldId: world.json().world.id, slug: 'test-03', title: 'T', environmentId: 'no-such-env' })).statusCode).toBe(422);
  });

  test('publishing goes through review and requires a playable level', async () => {
    // DRAFT → PUBLISHED directly is not a valid move.
    const direct = await call('POST', `/api/admin/levels/${levelId}/publish`);
    expect(direct.statusCode).toBe(409);
    expect(direct.json().error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'DRAFT', allowed: ['REVIEW', 'ARCHIVED'] } });

    const review = await call('POST', `/api/admin/levels/${levelId}/status`, { status: 'REVIEW', note: 'Ready for a look' });
    expect(review.statusCode).toBe(200);
    expect(review.json()).toMatchObject({ status: 'REVIEW', previousStatus: 'DRAFT', allowedNext: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] });

    const notReady = await call('POST', `/api/admin/levels/${levelId}/publish`);
    expect(notReady.statusCode).toBe(422);
    expect(notReady.json().error.code).toBe('LEVEL_NOT_READY');

    const patch = await call('PATCH', `/api/admin/levels/${levelId}`, {
      mapDefinition: { start: { x: 0, z: 0, heading: 0 }, finish: { shape: 'rect', center: { x: 1, z: 0 }, size: { x: 0.6, z: 0.6 } }, entities: [] },
      parBlocks: 1,
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().level.contentVersion).toBe(2);
    const obj = await call('POST', `/api/admin/levels/${levelId}/objectives`, { code: 'goal', title: 'Reach the goal', type: 'REACH_GOAL' });
    expect(obj.statusCode).toBe(201);
    // REACH_CHECKPOINT needs a checkpoint from this level.
    expect((await call('POST', `/api/admin/levels/${levelId}/objectives`, { code: 'cp-x', title: 'CP', type: 'REACH_CHECKPOINT' })).statusCode).toBe(422);

    const pub = await call('POST', `/api/admin/levels/${levelId}/publish`);
    expect(pub.statusCode).toBe(200);
    expect(pub.json()).toMatchObject({ status: 'PUBLISHED', visibleToStudents: false }); // curriculum still draft
    expect(await auditActions(levelId)).toEqual(['CREATE_LEVEL', 'REVIEW_LEVEL', 'UPDATE_LEVEL', 'PUBLISH_LEVEL']);

    // Removing the only goal from a published level is refused.
    expect((await call('DELETE', `/api/admin/objectives/${obj.json().objective.id}`)).statusCode).toBe(422);
    // Published levels can't be deleted.
    expect((await call('DELETE', `/api/admin/levels/${levelId}`)).statusCode).toBe(409);

    expect((await call('POST', `/api/admin/levels/${levelId}/unpublish`)).json().status).toBe('DRAFT');
    expect(await auditActions(levelId)).toContain('UNPUBLISH_LEVEL');

    // Archive and restore.
    expect((await call('POST', `/api/admin/levels/${levelId}/status`, { status: 'ARCHIVED' })).json().status).toBe('ARCHIVED');
    expect((await call('POST', `/api/admin/levels/${levelId}/status`, { status: 'REVIEW' })).statusCode).toBe(409);
    expect((await call('POST', `/api/admin/levels/${levelId}/status`, { status: 'DRAFT' })).json().status).toBe('DRAFT');
    expect(await auditActions(levelId)).toEqual(expect.arrayContaining(['ARCHIVE_LEVEL', 'RESTORE_LEVEL']));
  });

  test('unpublishing a live level hides it from students immediately', async () => {
    const student = await t.login('nguyenvana01');
    const s1 = await t.levelId('starter-01');
    await call('POST', `/api/admin/levels/${s1}/unpublish`);
    expect((await call('GET', '/api/levels/starter-01', undefined, student)).statusCode).toBe(404);
    // In review: still hidden from students.
    await call('POST', `/api/admin/levels/${s1}/status`, { status: 'REVIEW' });
    expect((await call('GET', '/api/levels/starter-01', undefined, student)).statusCode).toBe(404);
    expect((await call('POST', `/api/admin/levels/${s1}/publish`)).statusCode).toBe(200);
    expect((await call('GET', '/api/levels/starter-01', undefined, student)).statusCode).toBe(200);
  });

  test('prerequisite cycles are refused', async () => {
    const s1 = await t.levelId('starter-01');
    const s3 = await t.levelId('starter-03');
    // starter-03 ← starter-02 ← starter-01 already; making starter-01 require starter-03 loops.
    const res = await call('PUT', `/api/admin/levels/${s1}/prerequisites`, { groups: [{ requirements: [{ type: 'LEVEL_COMPLETED', levelId: s3 }] }] });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PREREQUISITE_CYCLE');
    const ok = await call('PUT', `/api/admin/levels/${levelId}/prerequisites`, { groups: [{ requirements: [{ type: 'LEVEL_COMPLETED', levelId: s3 }, { type: 'TOTAL_STARS', stars: 5 }] }] });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().groups[0].requirements).toHaveLength(2);
  });

  test('statistics and audit log', async () => {
    expect((await call('GET', '/api/admin/statistics')).json().totals.students).toBe(4);
    const logs = (await call('GET', '/api/admin/audit-logs?action=PUBLISH_LEVEL')).json().logs;
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toMatchObject({ action: 'PUBLISH_LEVEL', adminUsername: 'admin' });
  });

  test('achievement criteria must be a rule the server can evaluate', async () => {
    const bad = await call('POST', '/api/admin/achievements', { name: 'X', slug: 'x-ach', description: 'x', criteria: { type: 'eval', code: 'process.exit()' } });
    expect(bad.statusCode).toBe(400);
    const ok = await call('POST', '/api/admin/achievements', { name: 'Ten', slug: 'ten-levels', description: 'Complete 10.', criteria: { type: 'complete_levels', count: 10 } });
    expect(ok.statusCode).toBe(201);
  });
});

test('a TEACHER-like role only gets its permissions', async () => {
  await t.db.query(`INSERT INTO users (username, password_hash, display_name, role) SELECT 'teacher1', password_hash, 'Teacher', 'TEACHER' FROM users WHERE username = 'admin'`);
  const teacher = await t.login('teacher1', PASSWORDS.admin);
  expect((await call('GET', '/api/admin/students', undefined, teacher)).statusCode).toBe(200);
  expect((await call('POST', '/api/admin/students', { username: 'zz999', displayName: 'Z', password: 'Some-Pass-2026' }, teacher)).statusCode).toBe(403);
  expect((await call('POST', '/api/admin/levels', {}, teacher)).statusCode).toBe(403);
});
