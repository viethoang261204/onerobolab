import { useShallow } from 'zustand/react/shallow';
import { LevelRegistry } from '../../../content/levels/registry';
import { missionDataKeys } from '../../../content/levels/variants';
import { useProgramStore } from '../state/program-store';

const NONE: readonly string[] = [];

/** Names of the functions defined in the program (for “run …” dropdowns). */
export function useFunctionNames(enabled: boolean): readonly string[] {
  return useProgramStore(
    useShallow((s) => {
      if (!enabled) return NONE as string[];
      const out: string[] = [];
      for (const r of s.program.roots) {
        const b = s.program.blocks[r.id];
        if (b?.type === 'function.define' && typeof b.fields.name === 'string' && b.fields.name && !out.includes(b.fields.name)) out.push(b.fields.name);
      }
      return out;
    }),
  );
}

/** The mission values the current level provides (`mission.target`…). */
export function useMissionDataKeys(enabled: boolean): readonly string[] {
  const levelId = useProgramStore((s) => s.levelId);
  if (!enabled || !levelId) return NONE;
  const level = LevelRegistry.get(levelId);
  return level ? missionDataKeys(level) : NONE;
}
