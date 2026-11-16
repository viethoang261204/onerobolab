import { create } from 'zustand';
import { parseRoute, type Route } from './routes';

interface RouterState {
  path: string;
  route: Route;
  /** Go to a path (pushes history unless `replace`). No-op if already there. */
  navigate: (path: string, opts?: { replace?: boolean }) => void;
}

const hasWindow = typeof window !== 'undefined' && typeof window.history !== 'undefined';
const currentPath = () => (hasWindow ? window.location.pathname : '/');

/**
 * Tiny History-API router. Components read `route`; everything navigates via
 * `navigate()` (or `<a>` + `navigate` for real links). Back/forward work
 * through `popstate`.
 */
export const useRouterStore = create<RouterState>()((set, get) => ({
  path: currentPath(),
  route: parseRoute(currentPath()),
  navigate: (path, opts = {}) => {
    if (path === get().path) return;
    if (hasWindow) {
      if (opts.replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
    set({ path, route: parseRoute(path) });
  },
}));

if (hasWindow) {
  window.addEventListener('popstate', () => {
    const path = currentPath();
    useRouterStore.setState({ path, route: parseRoute(path) });
  });
}

/** Shorthand for event handlers outside React. */
export const navigate = (path: string, opts?: { replace?: boolean }) => useRouterStore.getState().navigate(path, opts);
