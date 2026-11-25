import type { CompileDiagnostic } from '@robolab/shared';
import type { BlockId } from './block-types.ts';

/** Thrown inside the compiler for a problem in one block; collected as a diagnostic. */
export class CompileProblem extends Error {
  readonly blockId: BlockId | null;

  constructor(message: string, blockId: BlockId | null) {
    super(message);
    this.blockId = blockId;
    this.name = 'CompileProblem';
  }
}

export const compileError = (message: string, blockId: BlockId | null): CompileDiagnostic => ({ severity: 'error', message, blockId });
export const compileWarning = (message: string, blockId: BlockId | null): CompileDiagnostic => ({ severity: 'warning', message, blockId });
