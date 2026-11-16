import { lazy, Suspense, useEffect, useRef } from 'react';
import { TopNavigation } from './components/navigation/TopNavigation';
import { LoginPage } from './features/account/LoginPage';
import { endStudentSession, restoreSession, startStudentSession } from './features/account/session-actions';
import { useStudentSession } from './features/account/session-store';
import { ConnectionBanner, JourneyError, JourneyLoading } from './features/account/SessionScreens';
import { useCatalogStore } from './features/catalog/catalog-store';
import { HomePage } from './features/home/pages/HomePage';
import { NotFoundPage } from './features/home/pages/NotFoundPage';
import { usePreviewStore } from './features/level-selection/previews/preview-store';
import { useWorldArtStore } from './features/world-map/art/world-art-store';
import { navigate, useRouterStore } from './features/router/router-store';
import { paths, type Route } from './features/router/routes';
import { useSettingsStore } from './features/settings/settings-store';

// Heavy pages load on demand: the Home page paints without the editor or the world map scene.
const SimulatorPage = lazy(() => import('./features/simulator/pages/SimulatorPage'));
const StudioPage = lazy(() => import('./features/programming/studio/StudioPage'));
const PreviewRenderer = lazy(() => import('./features/level-selection/previews/PreviewRenderer'));
const WorldArtRenderer = lazy(() => import('./features/world-map/art/WorldArtRenderer'));
const WorldMapPage = lazy(() => import('./features/world-map/pages/WorldMapPage'));
// Inside a world: the 2D adventure map (no three.js).
const AdventureMapPage = lazy(() => import('./features/adventure-map/pages/AdventureMapPage'));
const GaragePage = lazy(() => import('./features/garage/pages/GaragePage'));
// The admin console is a separate chunk with its own layout; students never load it from the game UI.
const AdminApp = lazy(() => import('./features/admin/AdminApp'));

const TITLES: Record<Route['name'], string> = {
  home: 'OneRoboLab',
  login: 'Sign in · OneRoboLab',
  robots: 'Robot Garage · OneRoboLab',
  world: 'World Map · OneRoboLab',
  studio: 'Code Studio · OneRoboLab',
  simulator: 'Simulator · OneRoboLab',
  admin: 'Admin · OneRoboLab',
  notFound: 'Not found · OneRoboLab',
};

function PageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading">
      <span className="h-9 w-9 animate-spin rounded-full border-2 border-cyan/25 border-t-cyan" />
    </div>
  );
}

/** Off-screen renderers (mission previews, world artwork), mounted only while something is queued. */
function Previews() {
  const busy = usePreviewStore((s) => s.queue.length > 0);
  const art = useWorldArtStore((s) => s.queue.length > 0);
  return (
    <Suspense fallback={null}>
      {busy && <PreviewRenderer />}
      {art && <WorldArtRenderer />}
    </Suspense>
  );
}

/** Where to go after signing in: a student page from `?next=`, else Home. */
function afterSignIn(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') && !next.startsWith('/admin') ? next : paths.home();
}

/** The student pages (signed in, catalog loaded): Home → World Map → Code Studio → Simulator. */
function StudentPages({ route }: { route: Exclude<Route, { name: 'admin' | 'login' }> }) {
  if (route.name === 'simulator' || route.name === 'studio') {
    return (
      <>
        <Suspense fallback={<PageLoading />}>{route.name === 'simulator' ? <SimulatorPage levelId={route.levelId} /> : <StudioPage levelId={route.levelId} />}</Suspense>
        <Previews />
      </>
    );
  }
  return (
    <div className="flex h-full min-w-[1024px] flex-col bg-bg">
      <Previews />
      <TopNavigation />
      <Suspense fallback={<PageLoading />}>
        {route.name === 'home' && <HomePage />}
        {route.name === 'world' && (route.worldId ? <AdventureMapPage worldId={route.worldId} levelId={route.levelId} /> : <WorldMapPage />)}
        {route.name === 'robots' && <GaragePage />}
        {route.name === 'notFound' && <NotFoundPage />}
      </Suspense>
    </div>
  );
}

/**
 * Route switch. The admin console has its own sign-in; every student page
 * needs a signed-in student whose journey (catalog) has loaded from the API.
 */
export function App() {
  const route = useRouterStore((s) => s.route);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const status = useStudentSession((s) => s.status);
  const user = useStudentSession((s) => s.user);
  const catalog = useCatalogStore((s) => s.status);
  const wasSignedIn = useRef(false);
  const isAdmin = route.name === 'admin';

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    if (!isAdmin) document.title = TITLES[route.name];
  }, [route.name, isAdmin]);

  // Page reload with a stored token.
  useEffect(() => {
    if (!isAdmin && useStudentSession.getState().status === 'restoring') void restoreSession();
  }, [isAdmin]);

  // Signed in (and past any forced password change): load the journey.
  const ready = status === 'signed-in' && !!user && !user.mustChangePassword;
  useEffect(() => {
    if (ready && user && useCatalogStore.getState().status === 'idle') {
      wasSignedIn.current = true;
      void startStudentSession(user);
    }
    // Session ended (sign-out, expired token): forget the journey.
    if (status === 'anonymous' && wasSignedIn.current) {
      wasSignedIn.current = false;
      endStudentSession();
    }
  }, [ready, status, user]);

  // Redirects between the sign-in page and the student pages.
  useEffect(() => {
    if (isAdmin) return;
    // Read the live route: a re-run effect (StrictMode) must not redirect twice and lose `next`.
    if (status === 'anonymous' && useRouterStore.getState().route.name !== 'login') navigate(paths.login(window.location.pathname), { replace: true });
    if (ready && catalog === 'ready' && route.name === 'login') navigate(afterSignIn(), { replace: true });
  }, [status, ready, catalog, route.name, isAdmin]);

  if (route.name === 'admin') {
    return (
      <Suspense fallback={<PageLoading />}>
        <AdminApp path={route.path} />
      </Suspense>
    );
  }

  let page;
  if (status === 'restoring') page = <JourneyLoading />;
  // Not ready: the sign-in page (or its forced password change); other paths are being redirected there.
  else if (!ready) page = route.name === 'login' || status === 'signed-in' ? <LoginPage /> : <JourneyLoading />;
  else if (catalog === 'error') page = <JourneyError />;
  else if (catalog !== 'ready' || route.name === 'login') page = <JourneyLoading />;
  else page = <StudentPages route={route} />;

  return (
    <>
      {page}
      {ready && <ConnectionBanner />}
    </>
  );
}
