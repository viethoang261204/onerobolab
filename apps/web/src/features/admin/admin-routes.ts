/**
 * Admin console routes (everything under /admin). Pure parse/build — the
 * app router hands `/admin/**` paths here.
 *
 *   /admin                         dashboard
 *   /admin/login                   sign in
 *   /admin/students[/:id[/:tab]]   students · student detail
 *   /admin/curriculum[/lessons]    curricula · lesson tree
 *   /admin/worlds
 *   /admin/levels[/:id[/:tab]]     levels · level editor
 *   /admin/programs[/:id]          programs (· one open in a drawer)
 *   /admin/attempts[/:id]          attempts (· one open in a drawer)
 *   /admin/achievements · /admin/analytics · /admin/audit-logs · /admin/settings
 */

export const STUDENT_TABS = ['profile', 'progress', 'programs', 'attempts', 'achievements'] as const;
export type StudentTab = (typeof STUDENT_TABS)[number];

export const LEVEL_TABS = ['details', 'objectives', 'hints', 'unlock', 'lessons', 'map'] as const;
export type LevelTab = (typeof LEVEL_TABS)[number];

export type AdminRoute =
  | { readonly page: 'login' }
  | { readonly page: 'dashboard' }
  | { readonly page: 'students' }
  | { readonly page: 'student'; readonly id: string; readonly tab: StudentTab }
  | { readonly page: 'curriculum'; readonly tab: 'curricula' | 'lessons' }
  | { readonly page: 'worlds' }
  | { readonly page: 'levels' }
  | { readonly page: 'level'; readonly id: string; readonly tab: LevelTab }
  | { readonly page: 'programs'; readonly id: string | null }
  | { readonly page: 'attempts'; readonly id: string | null }
  | { readonly page: 'achievements' }
  | { readonly page: 'analytics' }
  | { readonly page: 'audit' }
  | { readonly page: 'settings' }
  | { readonly page: 'notFound' };

export type AdminPage = AdminRoute['page'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isTab = <T extends string>(tabs: readonly T[], v: string | undefined): v is T => v !== undefined && (tabs as readonly string[]).includes(v);

export function parseAdminRoute(path: string): AdminRoute {
  const parts = path
    .split(/[?#]/)[0]!
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));
  if (parts[0] !== 'admin') return { page: 'notFound' };
  const [, a, b, c, ...rest] = parts;
  if (rest.length) return { page: 'notFound' };
  const id = b !== undefined && UUID.test(b) ? b : null;

  switch (a) {
    case undefined:
    case 'dashboard':
      return b === undefined ? { page: 'dashboard' } : { page: 'notFound' };
    case 'login':
      return { page: 'login' };
    case 'students':
      if (b === undefined) return { page: 'students' };
      if (id && (c === undefined || isTab(STUDENT_TABS, c))) return { page: 'student', id, tab: c ?? 'profile' };
      return { page: 'notFound' };
    case 'curriculum':
      if (b === undefined) return { page: 'curriculum', tab: 'curricula' };
      if (b === 'lessons' && c === undefined) return { page: 'curriculum', tab: 'lessons' };
      return { page: 'notFound' };
    case 'levels':
      if (b === undefined) return { page: 'levels' };
      if (id && (c === undefined || isTab(LEVEL_TABS, c))) return { page: 'level', id, tab: c ?? 'details' };
      return { page: 'notFound' };
    case 'programs':
    case 'attempts':
      if (c !== undefined || (b !== undefined && !id)) return { page: 'notFound' };
      return { page: a, id };
    case 'worlds':
    case 'achievements':
    case 'analytics':
    case 'settings':
      return b === undefined ? { page: a } : { page: 'notFound' };
    case 'audit-logs':
      return b === undefined ? { page: 'audit' } : { page: 'notFound' };
    default:
      return { page: 'notFound' };
  }
}

const enc = encodeURIComponent;

/** URL builders — the only place admin paths are spelled out. */
export const adminPaths = {
  dashboard: () => '/admin',
  login: (next?: string) => (next && next !== '/admin' ? `/admin/login?next=${enc(next)}` : '/admin/login'),
  students: () => '/admin/students',
  student: (id: string, tab: StudentTab = 'profile') => (tab === 'profile' ? `/admin/students/${enc(id)}` : `/admin/students/${enc(id)}/${tab}`),
  curriculum: () => '/admin/curriculum',
  lessons: () => '/admin/curriculum/lessons',
  worlds: () => '/admin/worlds',
  levels: () => '/admin/levels',
  level: (id: string, tab: LevelTab = 'details') => (tab === 'details' ? `/admin/levels/${enc(id)}` : `/admin/levels/${enc(id)}/${tab}`),
  programs: (id?: string) => (id ? `/admin/programs/${enc(id)}` : '/admin/programs'),
  attempts: (id?: string) => (id ? `/admin/attempts/${enc(id)}` : '/admin/attempts'),
  achievements: () => '/admin/achievements',
  analytics: () => '/admin/analytics',
  audit: () => '/admin/audit-logs',
  settings: () => '/admin/settings',
};

/** Where to go after signing in: only same-console paths (no open redirects). */
export function safeNext(search: string): string {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/admin') || next.startsWith('/admin/login') || next.includes('//')) return adminPaths.dashboard();
  return next;
}
