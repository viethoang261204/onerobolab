import { Loader2, SearchX, ShieldAlert } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { RouteLink } from '../router/RouteLink';
import { navigate } from '../router/router-store';
import { adminPaths, parseAdminRoute, safeNext, type AdminPage, type AdminRoute } from './admin-routes';
import { AdminShell } from './layout/AdminShell';
import { AchievementsPage } from './pages/achievements/AchievementsPage';
import { AttemptsPage, ProgramsPage } from './pages/activity/ActivityPages';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { AuditLogsPage } from './pages/audit/AuditLogsPage';
import { ChangePasswordPage, ForbiddenPage } from './pages/auth/AccessPages';
import { LoginPage } from './pages/auth/LoginPage';
import { CurriculumPage } from './pages/curriculum/CurriculumPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LevelEditorPage } from './pages/levels/LevelEditorPage';
import { LevelsPage } from './pages/levels/LevelsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { StudentDetailPage } from './pages/students/StudentDetailPage';
import { StudentsPage } from './pages/students/StudentsPage';
import { WorldsPage } from './pages/worlds/WorldsPage';
import { adminAccess, canOpen, type SessionUser } from './session/access';
import { restoreSession } from './session/session-actions';
import { useSessionStore, type SessionStatus } from './session/session-store';
import { EmptyState } from './ui/primitives';

const TITLES: Record<AdminPage, string> = {
  login: 'Sign in',
  dashboard: 'Dashboard',
  students: 'Students',
  student: 'Student',
  curriculum: 'Curriculum',
  worlds: 'Worlds',
  levels: 'Levels',
  level: 'Level editor',
  programs: 'Programs',
  attempts: 'Attempts',
  achievements: 'Achievements',
  analytics: 'Analytics',
  audit: 'Audit logs',
  settings: 'Settings',
  notFound: 'Not found',
};

function FullScreenLoading() {
  return (
    <div className="admin-root flex h-full items-center justify-center bg-adm-bg" role="status" aria-label="Loading">
      <Loader2 className="h-6 w-6 animate-spin text-adm-accent" aria-hidden />
    </div>
  );
}

function renderPage(route: AdminRoute): ReactNode {
  switch (route.page) {
    case 'dashboard':
      return <DashboardPage />;
    case 'students':
      return <StudentsPage />;
    case 'student':
      return <StudentDetailPage id={route.id} tab={route.tab} />;
    case 'curriculum':
      return <CurriculumPage tab={route.tab} />;
    case 'worlds':
      return <WorldsPage />;
    case 'levels':
      return <LevelsPage />;
    case 'level':
      return <LevelEditorPage id={route.id} tab={route.tab} />;
    case 'programs':
      return <ProgramsPage openId={route.id} />;
    case 'attempts':
      return <AttemptsPage openId={route.id} />;
    case 'achievements':
      return <AchievementsPage />;
    case 'analytics':
      return <AnalyticsPage />;
    case 'audit':
      return <AuditLogsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'login':
    case 'notFound':
      return (
        <EmptyState icon={SearchX} title="Page not found" action={<RouteLink to={adminPaths.dashboard()} className="text-sm font-medium text-adm-accent hover:underline">Back to the dashboard</RouteLink>}>
          This admin page doesn’t exist.
        </EmptyState>
      );
  }
}

/**
 * What the console shows for a session and path — no store access, so it
 * can be rendered in tests. Order of checks: restoring session → sign-in
 * page → not staff (students) → forced password change → per-page
 * permission → page.
 */
export function AdminView({ status, user, path }: { status: SessionStatus; user: SessionUser | null; path: string }) {
  const route = parseAdminRoute(path);
  const access = adminAccess(user);
  if (status === 'restoring') return <FullScreenLoading />;
  if (status === 'anonymous') return route.page === 'login' ? <LoginPage /> : <FullScreenLoading />;
  if (!user || access === 'forbidden') return <ForbiddenPage />;
  if (access === 'password-change') return <ChangePasswordPage />;
  if (route.page === 'login') return <FullScreenLoading />;
  return (
    <AdminShell user={user} page={route.page}>
      {route.page === 'notFound' || canOpen(user, route.page) ? (
        renderPage(route)
      ) : (
        <EmptyState icon={ShieldAlert} title="You don’t have permission to open this page">
          Ask an administrator if you need access.
        </EmptyState>
      )}
    </AdminShell>
  );
}

/** Admin console root (/admin/**, lazy chunk): session restore, redirects, then `AdminView`. */
export default function AdminApp({ path }: { path: string }) {
  const status = useSessionStore((s) => s.status);
  const user = useSessionStore((s) => s.user);
  const route = parseAdminRoute(path);
  const access = adminAccess(user);

  useEffect(() => {
    if (useSessionStore.getState().status === 'restoring') void restoreSession();
  }, []);

  useEffect(() => {
    document.title = `${TITLES[route.page]} · OneRoboLab Admin`;
  }, [route.page]);

  // Anonymous visitors are sent to sign in (and come back afterwards).
  useEffect(() => {
    if (status === 'anonymous' && route.page !== 'login') navigate(adminPaths.login(path + window.location.search), { replace: true });
    if (status === 'signed-in' && access === 'allowed' && route.page === 'login') navigate(safeNext(window.location.search), { replace: true });
  }, [status, access, route.page, path]);

  return <AdminView status={status} user={user} path={path} />;
}
