import { create } from 'zustand';
import { LEVELS, setLevelCatalog } from '../../content/levels/registry';
import { setWorldCatalog, WORLDS } from '../../content/worlds/registry';
import { errorMessage } from '../api/client';
import { studentApi } from '../account/student-api';
import { resetLevelSession, setCatalogRefresher, setProgressStore, useLevelStore } from '../levels/level-store';
import { LocalProgressStore, ServerProgressStore } from '../levels/progress';
import { memoryStorage } from '../persistence/storage';
import { buildCatalog } from './from-api';

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  readonly status: CatalogStatus;
  readonly error: string | null;
  /** Levels this app version can't show (unknown environment / no map). */
  readonly skipped: readonly string[];
  /** Bumps on every successful load/refresh (components that read registries can depend on it). */
  readonly version: number;
  load(): Promise<void>;
  refresh(): Promise<void>;
  clear(): void;
}

let store: ServerProgressStore | null = null;

/** Build the catalog and make it the content + progress in play. */
async function fetchAndApply(first: boolean): Promise<string[]> {
  const built = buildCatalog(await studentApi.catalog(), { levels: LEVELS, worlds: WORLDS });
  setWorldCatalog(built.worlds);
  setLevelCatalog(built.levels);
  if (first || !store) {
    store = new ServerProgressStore(built.progress);
    setProgressStore(store);
    resetLevelSession();
  } else {
    // Keep the level being played; only states / progress / totals change.
    useLevelStore.setState({ progress: store.replace({ ...built.progress, lastLevelId: store.getProgress().lastLevelId ?? built.progress.lastLevelId }) });
  }
  if (built.skipped.length) console.warn(`[catalog] Missions not shown (this app version can't render them): ${built.skipped.join(', ')}`);
  return [...built.skipped];
}

/**
 * The signed-in student's journey (worlds, levels, states, progress, totals)
 * from `GET /api/catalog`. Until it's loaded — and after sign-out — the app
 * shows no student pages; the bundled content is only the offline fallback.
 */
export const useCatalogStore = create<CatalogState>()((set, get) => ({
  status: 'idle',
  error: null,
  skipped: [],
  version: 0,
  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      const skipped = await fetchAndApply(true);
      set((s) => ({ status: 'ready', skipped, version: s.version + 1 }));
    } catch (e) {
      set({ status: 'error', error: errorMessage(e) });
    }
  },
  refresh: async () => {
    if (get().status !== 'ready') return;
    try {
      const skipped = await fetchAndApply(false);
      set((s) => ({ skipped, version: s.version + 1 }));
    } catch {
      // Keep what we have; the connection banner explains.
    }
  },
  clear: () => {
    store = null;
    setWorldCatalog([]);
    setLevelCatalog([]);
    setProgressStore(new LocalProgressStore(memoryStorage()));
    resetLevelSession();
    set({ status: 'idle', error: null, skipped: [] });
  },
}));

setCatalogRefresher(() => useCatalogStore.getState().refresh());
