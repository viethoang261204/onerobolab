import { create } from 'zustand';
import { modelInfo } from '../model/catalog';
import { DEFAULT_CONFIG, MAX_DECALS, decalText, normalizeConfig, type AccessoryId, type AnimationId, type DecalConfig, type DecalPlacement, type PartId, type PatternId, type RobotConfiguration, type RobotModelId, type WheelStyleId } from '../model/robot-config';

/*
 * Garage editing session (ephemeral): the draft robot with undo / redo, the
 * part being customised, the category panel and a hover preview colour.
 * Nothing is persisted until Save (robot-store).
 */

export type GarageCategory = 'robot' | 'paint' | 'patterns' | 'decals' | 'accessories' | 'animations';

const HISTORY = 50;

interface GarageState {
  draft: RobotConfiguration;
  past: RobotConfiguration[];
  future: RobotConfiguration[];
  /** Slot being edited (robot-store index; may equal its length = new robot). */
  slot: number;
  part: PartId;
  category: GarageCategory;
  /** Colour under the pointer (previewed on the selected part, not applied). */
  hoverColor: string | null;

  open: (slot: number, config: RobotConfiguration) => void;
  setCategory: (c: GarageCategory) => void;
  selectPart: (p: PartId) => void;
  previewColor: (hex: string | null) => void;

  setModel: (m: RobotModelId) => void;
  paint: (hex: string, part?: PartId) => void;
  paintMany: (colors: Partial<Record<PartId, string>>) => void;
  setPattern: (p: PatternId, part?: PartId) => void;
  setDecal: (placement: DecalPlacement, decal: Omit<DecalConfig, 'placement'> | null) => void;
  toggleAccessory: (a: AccessoryId) => void;
  setWheelStyle: (w: WheelStyleId) => void;
  setAnimation: (a: AnimationId) => void;
  rename: (name: string) => void;

  undo: () => void;
  redo: () => void;
  /** Back to the default robot (undoable). */
  reset: () => void;
}

export const useGarageStore = create<GarageState>()((set, get) => {
  /** Apply an edit to the draft, recording history (no-op edits are skipped). */
  const edit = (fn: (d: RobotConfiguration) => RobotConfiguration) => {
    const { draft, past } = get();
    const next = normalizeConfig(fn(draft));
    if (JSON.stringify(next) === JSON.stringify(draft)) return;
    set({ draft: next, past: [...past, draft].slice(-HISTORY), future: [] });
  };

  return {
    draft: DEFAULT_CONFIG,
    past: [],
    future: [],
    slot: 0,
    part: 'body',
    category: 'robot',
    hoverColor: null,

    open: (slot, config) => set({ slot, draft: normalizeConfig(config), past: [], future: [], part: 'body', hoverColor: null }),
    setCategory: (category) => set({ category, hoverColor: null }),
    selectPart: (part) => set({ part, hoverColor: null }),
    previewColor: (hoverColor) => set({ hoverColor }),

    setModel: (model) =>
      edit((d) => {
        // Keep decals only where the new model has room for them.
        const places = modelInfo(model).decalPlacements;
        return { ...d, model, decals: d.decals.filter((x) => places.includes(x.placement)) };
      }),
    paint: (hex, part) => {
      const p = part ?? get().part;
      edit((d) => ({ ...d, colors: { ...d.colors, [p]: hex } }));
      set({ hoverColor: null });
    },
    paintMany: (colors) => edit((d) => ({ ...d, colors: { ...d.colors, ...colors } })),
    setPattern: (pattern, part) => {
      const p = part ?? get().part;
      edit((d) => ({ ...d, patterns: { ...d.patterns, [p]: pattern } }));
    },
    setDecal: (placement, decal) =>
      edit((d) => {
        const rest = d.decals.filter((x) => x.placement !== placement);
        if (!decal) return { ...d, decals: rest };
        const text = decal.text ? decalText(decal.text) : undefined;
        // Adding past the limit replaces the oldest decal.
        const kept = rest.length >= MAX_DECALS ? rest.slice(1) : rest;
        return { ...d, decals: [...kept, { ...decal, placement, ...(text ? { text } : {}) }] };
      }),
    toggleAccessory: (a) => edit((d) => ({ ...d, accessories: d.accessories.includes(a) ? d.accessories.filter((x) => x !== a) : [...d.accessories, a] })),
    setWheelStyle: (wheelStyle) => edit((d) => ({ ...d, wheelStyle })),
    setAnimation: (animation) => edit((d) => ({ ...d, animation })),
    rename: (name) => edit((d) => ({ ...d, name })),

    undo: () => {
      const { past, draft, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ draft: prev, past: past.slice(0, -1), future: [draft, ...future] });
    },
    redo: () => {
      const { past, draft, future } = get();
      const next = future[0];
      if (!next) return;
      set({ draft: next, past: [...past, draft], future: future.slice(1) });
    },
    reset: () => edit((d) => ({ ...DEFAULT_CONFIG, name: d.name })),
  };
});

/** The configuration to render: the draft with the hover colour previewed on the selected part. */
export function previewConfig(s: Pick<GarageState, 'draft' | 'hoverColor' | 'part'>): RobotConfiguration {
  return s.hoverColor ? { ...s.draft, colors: { ...s.draft.colors, [s.part]: s.hoverColor } } : s.draft;
}
