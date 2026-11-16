import { create } from 'zustand';

/**
 * Ephemeral World Map UI state (which island is selected / hovered). Which
 * world is *entered* and which mission is open live in the URL; progress
 * comes from the level store — nothing here is persisted.
 */
interface WorldMapState {
  selectedId: string | null;
  hoveredId: string | null;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
}

export const useWorldMapStore = create<WorldMapState>()((set) => ({
  selectedId: null,
  hoveredId: null,
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set((s) => (s.hoveredId === hoveredId ? s : { hoveredId })),
}));
