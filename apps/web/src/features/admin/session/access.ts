import type { AdminPage } from '../admin-routes';

/**
 * Who may use the admin console. The API enforces every permission on every
 * request; this only decides what the console shows, so students never see it.
 */

export const ADMIN_PERMISSIONS = [
  'students.view',
  'students.manage',
  'progress.view',
  'levels.unlock',
  'curriculum.manage',
  'levels.publish',
  'content.manage',
  'achievements.manage',
  'statistics.view',
  'audit.view',
  'roles.manage',
] as const;
export type Permission = (typeof ADMIN_PERMISSIONS)[number];

export interface SessionUser {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly role: string;
  readonly avatarUrl: string | null;
  readonly mustChangePassword: boolean;
  readonly permissions: readonly string[];
}

export type AdminAccess = 'anonymous' | 'forbidden' | 'password-change' | 'allowed';

export function adminAccess(user: SessionUser | null): AdminAccess {
  if (!user) return 'anonymous';
  // Students are refused outright, whatever the permission table says.
  if (user.role === 'STUDENT') return 'forbidden';
  if (!ADMIN_PERMISSIONS.some((p) => user.permissions.includes(p))) return 'forbidden';
  if (user.mustChangePassword) return 'password-change';
  return 'allowed';
}

export const can = (user: SessionUser | null, permission: Permission): boolean => !!user && user.role !== 'STUDENT' && user.permissions.includes(permission);

/** Permissions that open a page (any one is enough); pages with none are open to every admin. */
export const PAGE_PERMISSIONS: Partial<Record<AdminPage, readonly Permission[]>> = {
  students: ['students.view'],
  student: ['students.view'],
  curriculum: ['curriculum.manage', 'content.manage'],
  worlds: ['curriculum.manage'],
  levels: ['curriculum.manage'],
  level: ['curriculum.manage'],
  programs: ['progress.view'],
  attempts: ['progress.view'],
  achievements: ['achievements.manage'],
  analytics: ['statistics.view'],
  audit: ['audit.view'],
};

export function canOpen(user: SessionUser | null, page: AdminPage): boolean {
  if (adminAccess(user) !== 'allowed') return false;
  const needed = PAGE_PERMISSIONS[page];
  return !needed || needed.some((p) => can(user, p));
}
