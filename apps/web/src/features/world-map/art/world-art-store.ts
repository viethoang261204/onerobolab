import { create } from 'zustand';

/** Bump when the dioramas change so cached artwork is re-rendered. */
const VERSION = 'v4';

export const artKey = (worldId: string, locked: boolean) => `${worldId}:${locked ? 'locked' : 'open'}`;
const storageKey = (key: string) => `roboverse.worldart.${VERSION}.${key}`;

const session = (): Storage | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

interface WorldArtState {
  /** artKey → PNG data URL (transparent background). */
  images: Record<string, string>;
  /** Waiting to be rendered (first = rendering now). */
  queue: string[];
  request: (worldId: string, locked: boolean) => void;
  done: (key: string, url: string | null) => void;
}

/**
 * World artwork for 2D screens (Home cards, Continue Learning, the journey
 * rail): each island diorama is rendered once, off-screen, by
 * `WorldArtRenderer`, and cached for the session — the same 3D island the
 * world map shows, never a separate drawing that could drift.
 */
export const useWorldArtStore = create<WorldArtState>()((set, get) => ({
  images: {},
  queue: [],
  request: (worldId, locked) => {
    const key = artKey(worldId, locked);
    const { images, queue } = get();
    if (images[key] || queue.includes(key)) return;
    const cached = session()?.getItem(storageKey(key));
    if (cached) set({ images: { ...images, [key]: cached } });
    else set({ queue: [...queue, key] });
  },
  done: (key, url) => {
    if (url) {
      try {
        session()?.setItem(storageKey(key), url);
      } catch {
        // storage full: memory only
      }
    }
    set((s) => ({ queue: s.queue.filter((q) => q !== key), images: url ? { ...s.images, [key]: url } : s.images }));
  },
}));
