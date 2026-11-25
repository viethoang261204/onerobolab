import { isBlockType } from './block-registry.ts';
import type { ProgramState } from './block-types.ts';
import { checkStructure } from './block-validation.ts';

const FORMAT = 'roboverse.blocks';

/** Stable JSON form of a program (for saving, sharing, and the future backend). */
export function serializeProgram(p: ProgramState): string {
  return JSON.stringify({ format: FORMAT, ...p });
}

/** Parse + verify saved JSON. Returns null for anything malformed. */
export function parseProgram(json: string): ProgramState | null {
  try {
    const raw: unknown = JSON.parse(json);
    if (typeof raw !== 'object' || raw === null) return null;
    const o = raw as Record<string, unknown>;
    if (o.format !== FORMAT || o.version !== 1) return null;
    if (typeof o.blocks !== 'object' || o.blocks === null || !Array.isArray(o.roots) || !Array.isArray(o.variables)) return null;
    const program = { version: 1, blocks: o.blocks, roots: o.roots, variables: o.variables } as ProgramState;
    if (!Object.values(program.blocks).every((b) => isBlockType(b.type))) return null;
    return checkStructure(program).length === 0 ? program : null;
  } catch {
    return null;
  }
}
