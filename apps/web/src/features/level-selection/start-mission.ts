import { Analytics } from '../analytics/analytics';
import { LevelRegistry } from '../../content/levels/registry';
import { useLevelStore } from '../levels/level-store';
import { navigate } from '../router/router-store';
import { paths } from '../router/routes';

/**
 * "Start mission": load the level through the level session (world,
 * mission, allowed blocks, saved program) and open its 3D simulator — the
 * student sees the place first; "Edit Program" opens Code Studio.
 * `from: 'map'` skips the briefing banner (the mission dialog just showed it).
 * Returns false for locked / unknown levels (nothing happens).
 */
export function startMission(levelId: string, from: 'map' | 'home' | 'result' = 'map'): boolean {
  // Missions with a briefing always open on it (BRIEFING → PREDICT → CODE); others skip it from the map.
  const briefing = !!LevelRegistry.get(levelId)?.briefing;
  if (!useLevelStore.getState().loadLevel(levelId, { intro: briefing || from !== 'map' })) return false;
  Analytics.track('mission_opened', { level: levelId, from });
  navigate(paths.simulator(levelId));
  return true;
}

/** "Test in Simulator": same level, same program, 3D screen. */
export const openSimulator = (levelId: string) => navigate(paths.simulator(levelId));

/** "Edit Program": back to Code Studio with the program intact. */
export const openStudio = (levelId: string) => navigate(paths.studio(levelId));
