/** One-shot visual effects requested by the simulation layer (rendered by `<Effects>`). */
export type EffectRequest = { readonly type: 'burst'; readonly x: number; readonly z: number; readonly color: string; readonly count?: number };

type Listener = (e: EffectRequest) => void;
const listeners = new Set<Listener>();

/** Decouples "something happened" (runtime) from "draw particles" (renderer). */
export const effectsBus = {
  emit(e: EffectRequest): void {
    for (const l of listeners) l(e);
  },
  on(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
