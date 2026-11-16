import { START_ID } from '../blocks/block-model';
import type { ProgramState } from '../blocks/block-types';

export type ProgramReadiness =
  | { readonly ok: true; readonly blocks: number }
  | { readonly ok: false; readonly reason: 'empty' | 'errors'; readonly message: string };

/**
 * Can this program be tested in the simulator? Used by "Test in Simulator"
 * before switching screens (the run controller re-checks on Run).
 */
export function checkProgram(program: ProgramState, errorCount: number): ProgramReadiness {
  const start = program.blocks[START_ID];
  let blocks = 0;
  for (let id = start?.next ?? null; id; id = program.blocks[id]?.next ?? null) blocks++;
  if (blocks === 0) return { ok: false, reason: 'empty', message: 'Your program is empty — snap a block under “when program starts” first.' };
  if (errorCount > 0) return { ok: false, reason: 'errors', message: `Fix ${errorCount === 1 ? 'the problem' : `${errorCount} problems`} marked in red before testing.` };
  return { ok: true, blocks };
}
