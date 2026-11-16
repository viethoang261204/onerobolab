import {
  BarChart3,
  BookOpen,
  Code2,
  ExternalLink,
  Globe2,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { RouteLink } from '../../router/RouteLink';
import { adminPaths, type AdminPage } from '../admin-routes';
import { canOpen, type SessionUser } from '../session/access';
import { signOut } from '../session/session-actions';
import { ConfirmHost, ToastHost } from '../ui/overlay';
import { Avatar, cx } from '../ui/primitives';

interface NavItem {
  readonly page: AdminPage;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly to: string;
  /** Detail pages that highlight this item. */
  readonly also?: readonly AdminPage[];
}

const NAV: readonly { readonly section: string; readonly items: readonly NavItem[] }[] = [
  { section: 'Overview', items: [{ page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: adminPaths.dashboard() }] },
  { section: 'People', items: [{ page: 'students', label: 'Students', icon: Users, to: adminPaths.students(), also: ['student'] }] },
  {
    section: 'Content',
    items: [
      { page: 'curriculum', label: 'Curriculum', icon: BookOpen, to: adminPaths.curriculum() },
      { page: 'worlds', label: 'Worlds', icon: Globe2, to: adminPaths.worlds() },
      { page: 'levels', label: 'Levels', icon: Layers, to: adminPaths.levels(), also: ['level'] },
      { page: 'achievements', label: 'Achievements', icon: Trophy, to: adminPaths.achievements() },
    ],
  },
  {
    section: 'Activity',
    items: [
      { page: 'programs', label: 'Programs', icon: Code2, to: adminPaths.programs() },
      { page: 'attempts', label: 'Attempts', icon: History, to: adminPaths.attempts() },
      { page: 'analytics', label: 'Analytics', icon: BarChart3, to: adminPaths.analytics() },
      { page: 'audit', label: 'Audit Logs', icon: ScrollText, to: adminPaths.audit() },
    ],
  },
  { section: 'System', items: [{ page: 'settings', label: 'Settings', icon: Settings, to: adminPaths.settings() }] },
];

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrator', SUPER_ADMIN: 'Super admin', TEACHER: 'Teacher', CONTENT_EDITOR: 'Content editor' };
export const roleLabel = (role: string) => ROLE_LABEL[role] ?? role;

/** The console frame: dark sidebar, light work area. */
export function AdminShell({ user, page, children }: { user: SessionUser; page: AdminPage; children: ReactNode }) {
  return (
    <div className="admin-root flex h-full min-w-[1200px] bg-adm-bg">
      <aside className="flex w-60 shrink-0 flex-col bg-adm-nav text-adm-nav-text" aria-label="Admin navigation">
        <div className="flex h-14 items-center gap-2.5 border-b border-white/8 px-5">
          <img src="/brand/onespace-mark.svg" width={28} height={28} alt="" aria-hidden className="h-7 w-7 shrink-0" draggable={false} />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">OneRoboLab</p>
            <p className="text-[11px] tracking-wide text-slate-400 uppercase">Admin console</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => {
            const items = group.items.filter((i) => canOpen(user, i.page));
            if (!items.length) return null;
            return (
              <div key={group.section} className="mb-5">
                <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{group.section}</p>
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const active = item.page === page || !!item.also?.includes(page);
                    const Icon = item.icon;
                    return (
                      <li key={item.page}>
                        <RouteLink
                          to={item.to}
                          aria-current={active ? 'page' : undefined}
                          className={cx(
                            'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                            active ? 'bg-adm-nav-2 font-medium text-white shadow-[inset_2px_0_0_var(--color-adm-accent)]' : 'hover:bg-white/5 hover:text-white',
                          )}
                        >
                          <Icon className={cx('h-4 w-4', active ? 'text-[#93b4ff]' : 'text-slate-400')} aria-hidden />
                          {item.label}
                        </RouteLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/8 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <Avatar name={user.displayName} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-white">{user.displayName}</p>
              <p className="truncate text-xs text-slate-400">{roleLabel(user.role)}</p>
            </div>
          </div>
          <div className="mt-1 flex gap-1">
            <a href="/" target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Student app
            </a>
            <button type="button" onClick={() => void signOut()} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white">
              <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      </aside>
      <main id="admin-main" className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] px-8 py-6">{children}</div>
      </main>
      <ConfirmHost />
      <ToastHost />
    </div>
  );
}
