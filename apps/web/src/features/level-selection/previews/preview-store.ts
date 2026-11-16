import { create } from 'zustand';
import { LevelRegistry } from '../../../content/levels/registry';

/** Bump when environments change so cached previews are re-rendered. */
const VERSION = 'v1';
/** Levels from the API include their content version, so an edited map gets a fresh preview. */
const key = (levelId: string) => `roboverse.preview.${VERSION}.${levelId}.${LevelRegistry.get(levelId)?.server?.contentVersion ?? 'b'}`;

const session = (): Storage | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

interface PreviewState {
  /** levelId → JPEG data URL. */
  images: Record<string, string>;
  /** Levels waiting to be rendered (first = rendering now). */
  queue: string[];
  request: (levelId: string) => void;
  done: (levelId: string, url: string | null) => void;
}

/**
 * Rendered environment previews for mission cards. Each level's real 3D
 * environment is rendered once, off-screen (`PreviewRenderer`), and cached
 * for the session — no hand-made thumbnails that could drift from the scene.
 */
export const usePreviewStore = create<PreviewState>()((set, get) => ({
  images: {},
  queue: [],
  request: (levelId) => {
    const { images, queue } = get();
    if (images[levelId] || queue.includes(levelId)) return;
    const cached = session()?.getItem(key(levelId));
    if (cached) set({ images: { ...images, [levelId]: cached } });
    else set({ queue: [...queue, levelId] });
  },
  done: (levelId, url) => {
    if (url) {
      try {
        session()?.setItem(key(levelId), url);
      } catch {
        // storage full: keep it in memory only
      }
    }
    set((s) => ({ queue: s.queue.filter((q) => q !== levelId), images: url ? { ...s.images, [levelId]: url } : s.images }));
  },
}));
