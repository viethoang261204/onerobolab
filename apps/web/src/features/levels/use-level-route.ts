import { useEffect } from 'react';
import { navigate } from '../router/router-store';
import { useLevelStore } from './level-store';

/**
 * Binds a level-scoped page (`/studio/:levelId`, `/simulator/:levelId`) to the
 * level session: loads the URL's level (or keeps / restores the current one)
 * and keeps the URL in sync when the level changes on the page. Both pages
 * share the one level session and the one program store, so moving between
 * them never reloads or resets the program.
 */
export function useLevelRoute(levelId: string | null, pathFor: (levelId: string) => string): void {
  // URL follows the loaded level (replace: switching levels isn't a history step).
  useEffect(
    () =>
      useLevelStore.subscribe((s, prev) => {
        if (s.levelId !== prev.levelId) navigate(pathFor(s.levelId), { replace: true });
      }),
    [pathFor],
  );

  useEffect(() => {
    const id = useLevelStore.getState().enter(levelId);
    if (id !== levelId) navigate(pathFor(id), { replace: true });
  }, [levelId, pathFor]);
}
