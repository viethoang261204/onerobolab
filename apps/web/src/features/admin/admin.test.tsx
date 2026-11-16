import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRoute } from '../router/routes';
import { AdminView } from './AdminApp';
import { adminPaths, parseAdminRoute, safeNext } from './admin-routes';
import { ApiError, createApiClient, toQueryString } from './api/client';
import type { GraphLevel, LevelSummary } from './api/types';
import { bodyToLesson, isSafeUrl, lessonToBody, move, slugify } from './lib/content';
import { buildDependencyGraph, lineage } from './lib/dependency-graph';
import { formatDate, formatDuration, formatPercent, relativeTime } from './lib/format';
import { actionLabel, auditDetails, workflowActions } from './lib/labels';
import { outlineProgram, outlineText } from './lib/program-outline';
import { describeUnlock, draftProblems, emptyGroup, fromDraft, toDraft } from './lib/unlock-rules';
import { adminAccess, canOpen, type SessionUser } from './session/access';
import { useSessionStore } from './session/session-store';

const html = (el: ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

const user = (over: Partial<SessionUser> = {}): SessionUser => ({
  id: 'u1',
  username: 'admin',
  displayName: 'OneRoboLab Administrator',
  role: 'ADMIN',
  avatarUrl: null,
  mustChangePassword: false,
  permissions: ['students.view', 'students.manage', 'progress.view', 'levels.unlock', 'curriculum.manage', 'levels.publish', 'content.manage', 'achievements.manage', 'statistics.view', 'audit.view'],
  ...over,
});
const STUDENT = user({ id: 's1', username: 'nguyenvana01', displayName: 'Nguyễn Văn A', role: 'STUDENT', permissions: [] });
const TEACHER = user({ id: 't1', username: 'teacher', displayName: 'Cô Lan', role: 'TEACHER', permissions: ['students.view', 'progress.view', 'levels.unlock', 'statistics.view'] });

afterEach(() => useSessionStore.setState({ token: null, user: null, status: 'anonymous', notice: null }));

// ── routing ─────────────────────────────────────────────────────────────
describe('admin routes', () => {
  const id = '3f1c2a4e-9b7d-4c1e-8a2f-0d6b5e4c3a21';

  it('the app router hands every /admin path to the console', () => {
    expect(parseRoute('/admin')).toEqual({ name: 'admin', path: '/admin' });
    expect(parseRoute('/admin/levels/x/y/z/w')).toMatchObject({ name: 'admin' });
  });

  it('parses and builds every page', () => {
    expect(parseAdminRoute('/admin')).toEqual({ page: 'dashboard' });
    expect(parseAdminRoute('/admin/login?next=/admin/levels')).toEqual({ page: 'login' });
    expect(parseAdminRoute(adminPaths.student(id, 'attempts'))).toEqual({ page: 'student', id, tab: 'attempts' });
    expect(parseAdminRoute(adminPaths.student(id))).toEqual({ page: 'student', id, tab: 'profile' });
    expect(parseAdminRoute(adminPaths.level(id, 'unlock'))).toEqual({ page: 'level', id, tab: 'unlock' });
    expect(parseAdminRoute(adminPaths.lessons())).toEqual({ page: 'curriculum', tab: 'lessons' });
    expect(parseAdminRoute(adminPaths.attempts(id))).toEqual({ page: 'attempts', id });
    expect(parseAdminRoute(adminPaths.programs())).toEqual({ page: 'programs', id: null });
    expect(parseAdminRoute(adminPaths.audit())).toEqual({ page: 'audit' });
    for (const bad of ['/admin/students/not-a-uuid', `/admin/levels/${id}/nope`, '/admin/unknown', '/admin/worlds/x']) expect(parseAdminRoute(bad).page).toBe('notFound');
  });

  it('only redirects back inside the console after sign-in (no open redirects)', () => {
    expect(safeNext('?next=%2Fadmin%2Flevels')).toBe('/admin/levels');
    expect(safeNext('?next=https%3A%2F%2Fevil.example')).toBe('/admin');
    expect(safeNext('?next=%2F%2Fevil.example%2Fadmin')).toBe('/admin');
    expect(safeNext('?next=%2Fadmin%2Flogin')).toBe('/admin');
    expect(adminPaths.login('/admin/students')).toBe('/admin/login?next=%2Fadmin%2Fstudents');
  });
});

// ── access ──────────────────────────────────────────────────────────────
describe('admin access', () => {
  it('students are always refused, whatever their permissions', () => {
    expect(adminAccess(STUDENT)).toBe('forbidden');
    expect(adminAccess({ ...STUDENT, permissions: ['students.view'] })).toBe('forbidden');
    expect(canOpen(STUDENT, 'dashboard')).toBe(false);
  });

  it('staff roles get the pages their permissions allow', () => {
    expect(adminAccess(null)).toBe('anonymous');
    expect(adminAccess(user({ role: 'GUEST', permissions: [] }))).toBe('forbidden');
    expect(adminAccess(user({ mustChangePassword: true }))).toBe('password-change');
    expect(adminAccess(TEACHER)).toBe('allowed');
    expect(canOpen(TEACHER, 'students')).toBe(true);
    expect(canOpen(TEACHER, 'attempts')).toBe(true);
    expect(canOpen(TEACHER, 'levels')).toBe(false);
    expect(canOpen(TEACHER, 'audit')).toBe(false);
    expect(canOpen(user(), 'audit')).toBe(true);
  });

  it('a signed-in student sees “No access” and no admin navigation', () => {
    const out = html(<AdminView status="signed-in" user={STUDENT} path="/admin/students" />);
    expect(out).toContain('No access');
    expect(out).not.toContain('Admin navigation');
    expect(out).not.toContain('Students');
  });

  it('an admin sees the console; a teacher only sees their sections', () => {
    const admin = html(<AdminView status="signed-in" user={user()} path="/admin/levels" />);
    expect(admin).toContain('Admin navigation');
    for (const label of ['Dashboard', 'Students', 'Curriculum', 'Worlds', 'Levels', 'Programs', 'Attempts', 'Achievements', 'Analytics', 'Audit Logs', 'Settings']) expect(admin).toContain(label);

    const teacher = html(<AdminView status="signed-in" user={TEACHER} path="/admin/levels" />);
    expect(teacher).toContain('Students');
    expect(teacher).not.toContain('Audit Logs');
    expect(teacher).toContain('You don’t have permission to open this page');
  });

  it('nobody signed in: nothing of the console renders', () => {
    const out = html(<AdminView status="anonymous" user={null} path="/admin/students" />);
    expect(out).not.toContain('Admin navigation');
    expect(html(<AdminView status="anonymous" user={null} path="/admin/login" />)).toContain('Sign in');
    // A staff member who must change their password sees only that form.
    expect(html(<AdminView status="signed-in" user={user({ mustChangePassword: true })} path="/admin" />)).toContain('Choose a new password');
  });
});

// ── API client ──────────────────────────────────────────────────────────
describe('API client', () => {
  const respond = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('sends the bearer token and a clean query string', async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => respond(200, { ok: true }));
    const api = createApiClient({ baseUrl: 'https://api.example.com/', getToken: () => 'tok', onUnauthorized: () => {}, fetch: fetchMock });
    await api.get('/api/admin/students', { search: 'an', status: undefined, page: 2, empty: '' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/api/admin/students?search=an&page=2');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(init!.credentials).toBe('omit');
    expect(toQueryString({})).toBe('');
  });

  it('turns the error envelope into ApiError (with field errors)', async () => {
    const api = createApiClient({
      baseUrl: '',
      getToken: () => 'tok',
      onUnauthorized: () => {},
      fetch: async () => respond(400, { error: { code: 'VALIDATION_FAILED', message: 'The request is not valid.', details: [{ path: 'username', message: 'Too short' }] } }),
    });
    const err = await api.post('/api/admin/students', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('VALIDATION_FAILED');
    expect((err as ApiError).fieldErrors()).toEqual({ username: 'Too short' });
  });

  it('401 on a signed-in call ends the session (but not a failed login)', async () => {
    const onUnauthorized = vi.fn();
    const api = createApiClient({ baseUrl: '', getToken: () => 'tok', onUnauthorized, fetch: async () => respond(401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } }) });
    await api.get('/api/admin/students').catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await api.post('/api/auth/login', {}).catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('network failures and 204s', async () => {
    const down = createApiClient({ baseUrl: '', getToken: () => null, onUnauthorized: () => {}, fetch: async () => Promise.reject(new TypeError('offline')) });
    expect(await down.get('/health').catch((e: ApiError) => e.status)).toBe(0);
    const empty = createApiClient({ baseUrl: '', getToken: () => null, onUnauthorized: () => {}, fetch: async () => new Response(null, { status: 204 }) });
    expect(await empty.del('/api/x')).toBeUndefined();
  });
});

// ── pure helpers ────────────────────────────────────────────────────────
describe('formatting and labels', () => {
  it('dates, durations, percentages', () => {
    expect(formatDate('2026-09-29T10:00:00')).toBe('29/09/2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDuration(4.25)).toBe('4.3 s');
    expect(formatDuration(125)).toBe('2 min 05 s');
    expect(formatPercent(66.67)).toBe('66.7%');
    const now = new Date('2026-09-29T12:00:00Z');
    expect(relativeTime('2026-09-29T11:55:00Z', now)).toBe('5 min ago');
    expect(relativeTime('2026-09-28T12:00:00Z', now)).toBe('yesterday');
    expect(relativeTime(null, now)).toBe('Never');
  });

  it('workflow buttons follow DRAFT → REVIEW → PUBLISHED → ARCHIVED', () => {
    expect(workflowActions('DRAFT').map((a) => a.to)).toEqual(['REVIEW', 'ARCHIVED']);
    expect(workflowActions('DRAFT').some((a) => a.to === 'PUBLISHED')).toBe(false);
    expect(workflowActions('REVIEW').find((a) => a.to === 'PUBLISHED')?.live).toBe(true);
    expect(workflowActions('PUBLISHED').map((a) => a.to)).toEqual(['DRAFT', 'ARCHIVED']);
    expect(workflowActions('ARCHIVED').map((a) => a.to)).toEqual(['DRAFT']);
  });

  it('audit entries read like sentences', () => {
    expect(actionLabel('UNLOCK_LEVEL')).toBe('Unlocked level');
    expect(actionLabel('PUBLISH_WORLD')).toBe('Published world');
    expect(actionLabel('REORDER_HINTS')).toBe('Reordered hints');
    expect(
      auditDetails({ entityType: 'student_level_access', studentName: 'Nguyễn Văn A', levelTitle: 'Bridge Crossing', entityName: null, newData: { reason: 'Extra practice' }, oldData: null }),
    ).toEqual(['Student: Nguyễn Văn A', 'Level: Bridge Crossing', 'Reason: Extra practice']);
    expect(auditDetails({ entityType: 'level', studentName: null, levelTitle: 'Sharp Turn', entityName: null, oldData: { status: 'REVIEW' }, newData: { status: 'PUBLISHED' } })).toContain(
      'Status: In review → Published',
    );
  });

  it('content helpers', () => {
    expect(slugify('Cầu Treo — Bridge 2!')).toBe('cau-treo-bridge-2');
    expect(slugify('Đường đua')).toBe('duong-dua');
    expect(move(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('https://example.com/v.mp4')).toBe(true);
    const tip = bodyToLesson({ kind: 'tip', text: 'Count the slabs', url: '', caption: '' });
    expect(tip).toEqual({ contentType: 'TEXT', content: { text: 'Count the slabs', variant: 'tip' } });
    expect(lessonToBody(tip.contentType, tip.content).kind).toBe('tip');
    expect(lessonToBody('MARKDOWN', { markdown: '# Loops' })).toMatchObject({ kind: 'lesson', text: '# Loops' });
  });
});

// ── unlock rules & dependency graph ─────────────────────────────────────
const lvl = (id: string, title: string, worldId: string, sortOrder: number, prerequisites: GraphLevel['prerequisites'] = [], extra: Partial<GraphLevel> = {}): GraphLevel => ({
  id,
  slug: id,
  title,
  status: 'PUBLISHED',
  visibility: 'VISIBLE',
  accessMode: 'AUTO',
  sortOrder,
  worldId,
  worldName: worldId === 'w1' ? 'Starter Island' : 'Canyon Circuit',
  worldSlug: worldId,
  worldOrder: worldId === 'w1' ? 1 : 2,
  curriculumId: 'c1',
  curriculumName: 'Robotics Foundations',
  prerequisites,
  ...extra,
});
const req = (levelId: string, levelTitle: string) => ({ groupId: `g-${levelId}`, name: null, sortOrder: 1, requirements: [{ type: 'LEVEL_COMPLETED' as const, levelId, levelTitle }] });

describe('unlock rules', () => {
  it('describes rules in plain words', () => {
    expect(describeUnlock('UNLOCKED', [])).toBe('Unlocked for everyone');
    expect(describeUnlock('LOCKED', [req('a', 'A')])).toBe('Locked for everyone');
    expect(describeUnlock('AUTO', [])).toBe('Always available');
    expect(
      describeUnlock('AUTO', [
        req('s', 'Sharp Turn'),
        { groupId: 'g2', name: null, sortOrder: 2, requirements: [{ type: 'TOTAL_STARS', stars: 15 }] },
      ]),
    ).toBe('After Sharp Turn, or 15★ in total');
  });

  it('draft round trip and validation', () => {
    const groups = [req('a', 'A'), { groupId: 'g2', name: null, sortOrder: 2, requirements: [{ type: 'LEVEL_STARS' as const, levelId: 'b', stars: 2 }, { type: 'TOTAL_XP' as const, xp: 300 }] }];
    expect(fromDraft(toDraft(groups))).toEqual([
      { requirements: [{ type: 'LEVEL_COMPLETED', levelId: 'a' }] },
      { requirements: [{ type: 'LEVEL_STARS', levelId: 'b', stars: 2 }, { type: 'TOTAL_XP', xp: 300 }] },
    ]);
    expect(draftProblems([emptyGroup()], 'self')).toEqual(['Group 1, requirement 1: choose a level.']);
    expect(draftProblems(toDraft([req('self', 'Me')]), 'self')[0]).toContain('cannot require itself');
  });
});

describe('dependency graph', () => {
  const levels = [
    lvl('s1', 'First Steps', 'w1', 1),
    lvl('s2', 'Sharp Turn', 'w1', 2, [req('s1', 'First Steps')]),
    lvl('s3', 'Staircase', 'w1', 3, [req('s2', 'Sharp Turn')]),
    // Canyon 1 unlocks after the whole Starter world, or with 15 stars (not a level → note).
    lvl('c1', 'Bridge Crossing', 'w2', 1, [
      { groupId: 'x', name: null, sortOrder: 1, requirements: [{ type: 'WORLD_COMPLETED', worldId: 'w1', worldName: 'Starter Island' }] },
      { groupId: 'y', name: null, sortOrder: 2, requirements: [{ type: 'TOTAL_STARS', stars: 15 }] },
    ]),
  ];

  it('places levels in columns by how many levels come first', () => {
    const g = buildDependencyGraph(levels);
    const col = Object.fromEntries(g.nodes.map((n) => [n.id, n.col]));
    expect(col).toEqual({ s1: 0, s2: 1, s3: 2, c1: 3 });
    expect(g.edges.filter((e) => e.to === 'c1' && e.kind === 'world')).toHaveLength(3);
    expect(g.nodes.find((n) => n.id === 'c1')?.extras).toEqual(['15★ in total']);
    expect(g.width).toBeGreaterThan(0);
  });

  it('highlights what a level needs and unlocks; survives a cycle', () => {
    const g = buildDependencyGraph(levels);
    const { ancestors, descendants } = lineage(g, 's2');
    expect([...ancestors]).toEqual(['s1']);
    expect([...descendants].sort()).toEqual(['c1', 's3']);
    const cyclic = buildDependencyGraph([lvl('a', 'A', 'w1', 1, [req('b', 'B')]), lvl('b', 'B', 'w1', 2, [req('a', 'A')])]);
    expect(cyclic.nodes).toHaveLength(2);
  });
});

// ── program viewer ──────────────────────────────────────────────────────
describe('program outline', () => {
  const program = {
    format: 'roboverse.blocks',
    version: 1,
    variables: ['laps'],
    roots: [
      { id: 'start', x: 40, y: 28 },
      { id: 'loose', x: 400, y: 300 },
    ],
    blocks: {
      start: { id: 'start', type: 'event.start', fields: {}, inputs: {}, slots: {}, next: 'r' },
      r: { id: 'r', type: 'control.repeat', fields: { count: 4 }, inputs: { count: null }, slots: { body: 'f' }, next: 'i' },
      f: { id: 'f', type: 'motion.forward', fields: { distance: 50 }, inputs: { distance: null }, slots: {}, next: 't', comment: 'one side' },
      t: { id: 't', type: 'motion.turnLeft', fields: { angle: 90 }, inputs: { angle: null }, slots: {}, next: null },
      i: { id: 'i', type: 'control.ifElse', fields: {}, inputs: { condition: 'c' }, slots: { then: 's', else: null }, next: null },
      c: { id: 'c', type: 'logic.compare', fields: { a: 0, op: '<', b: 20 }, inputs: { a: 'd', b: null }, slots: {}, next: null },
      d: { id: 'd', type: 'sensor.distance', fields: {}, inputs: {}, slots: {}, next: null },
      s: { id: 's', type: 'motion.stop', fields: {}, inputs: {}, slots: {}, next: null },
      loose: { id: 'loose', type: 'motion.backward', fields: { distance: 10 }, inputs: { distance: null }, slots: {}, next: null },
    },
  };

  it('reads like the editor, with nesting', () => {
    const o = outlineProgram(program)!;
    expect(outlineText(o)).toBe(
      [
        'when program starts',
        'repeat 4 times',
        '  move forward 50 cm',
        '  turn left 90°',
        'if distance (cm) < 20 then',
        '  stop',
        'else',
        '  (empty)',
        'Detached blocks (not run)',
        'move backward 10 cm',
      ].join('\n'),
    );
    expect(o.runnableBlocks).toBe(5);
    expect(o.lines.find((l) => l.key === 'f')?.comment).toBe('one side');
    expect(o.python).toContain('for _ in range(4):');
    expect(o.python).toContain('robot.move_forward(50)');
  });

  it('prefers the stored Python and rejects garbage', () => {
    expect(outlineProgram(program, 'print("stored")')!.python).toBe('print("stored")');
    expect(outlineProgram({ hello: 'world' })).toBeNull();
    expect(outlineProgram(null)).toBeNull();
  });
});

// Type-level guard: list rows carry the unlock-rule data the table shows.
const _row: Pick<LevelSummary, 'accessMode' | 'prerequisites'> = { accessMode: 'AUTO', prerequisites: [] };
void _row;
