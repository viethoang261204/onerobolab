import { START_ID } from '@robolab/blocks';
import type { ProgramState } from '@robolab/blocks';
import { messagesFor } from '../../i18n/i18n';
import { programmingMessages } from '../programming.messages';

export type ProgramReadiness =
  | { readonly ok: true; readonly blocks: number }
  | { readonly ok: false; readonly reason: 'empty' | 'errors'; readonly message: string };

/**
 * Can this program be tested in the simulator? Used by "Test in Simulator"
 * before switching screens (the run controller re-checks on Run).
 */
export function checkProgram(program: ProgramState, errorCount: number): ProgramReadiness {
  const m = messagesFor(programmingMessages);
  const start = program.blocks[START_ID];
  let blocks = 0;
  for (let id = start?.next ?? null; id; id = program.blocks[id]?.next ?? null) blocks++;
  if (blocks === 0) return { ok: false, reason: 'empty', message: m.checkEmpty };
  if (errorCount > 0) return { ok: false, reason: 'errors', message: m.checkErrors({ n: errorCount }) };
  return { ok: true, blocks };
}
