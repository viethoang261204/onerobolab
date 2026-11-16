/**
 * App routes. Pure parse/build functions (tested) — the router store wires
 * them to the History API. No routing library: the app has five URL shapes.
 *
 *   /  · /home                         → home
 *   /world · /explore                  → world map
 *   /world/:worldId                    → the world's adventure map
 *   /world/:worldId/level/:levelId     → adventure map, mission briefing open
 *   /studio · /studio/:levelId         → Code Studio (write the program)
 *   /simulator · /simulator/:levelId   → 3D simulator (test the program)
 *   /robots                            → Robot Garage (customise your robot)
 *   /login                             → student sign-in (every other student page needs a session)
 *   /admin/**                          → admin console (own sub-router: features/admin/admin-routes.ts)
 */
export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'world'; readonly worldId: string | null; readonly levelId: string | null }
  | { readonly name: 'studio'; readonly levelId: string | null }
  | { readonly name: 'simulator'; readonly levelId: string | null }
  | { readonly name: 'admin'; readonly path: string }
  | { readonly name: 'login' }
  | { readonly name: 'robots' }
  | { readonly name: 'notFound'; readonly path: string };

const segments = (path: string) =>
  path
    .split(/[?#]/)[0]!
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));

export function parseRoute(path: string): Route {
  const all = segments(path);
  if (all[0] === 'admin') return { name: 'admin', path };
  const [a, b, c, d, ...rest] = all;
  if (rest.length) return { name: 'notFound', path };
  if (a === undefined || (a === 'home' && b === undefined)) return { name: 'home' };
  if (a === 'login' && b === undefined) return { name: 'login' };
  if ((a === 'robots' || a === 'garage') && b === undefined) return { name: 'robots' };
  if (a === 'world' || a === 'explore') {
    if (b === undefined) return { name: 'world', worldId: null, levelId: null };
    if (c === undefined) return { name: 'world', worldId: b, levelId: null };
    if (c === 'level' && d !== undefined) return { name: 'world', worldId: b, levelId: d };
  }
  if (a === 'simulator' && c === undefined) return { name: 'simulator', levelId: b ?? null };
  if ((a === 'studio' || a === 'code') && c === undefined) return { name: 'studio', levelId: b ?? null };
  return { name: 'notFound', path };
}

const enc = encodeURIComponent;

/** URL builders — the only place paths are spelled out. */
export const paths = {
  home: () => '/',
  /** Sign-in; `next` = where to go afterwards (student pages only). */
  login: (next?: string) => (next && next !== '/' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? `/login?next=${enc(next)}` : '/login'),
  worldMap: () => '/world',
  robots: () => '/robots',
  world: (worldId: string) => `/world/${enc(worldId)}`,
  level: (worldId: string, levelId: string) => `/world/${enc(worldId)}/level/${enc(levelId)}`,
  studio: (levelId?: string) => (levelId ? `/studio/${enc(levelId)}` : '/studio'),
  simulator: (levelId?: string) => (levelId ? `/simulator/${enc(levelId)}` : '/simulator'),
};
