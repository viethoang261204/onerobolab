import type { CompileDiagnostic } from '@robolab/shared';
import type { BlockId } from '../blocks/block-types';

/** Thrown inside the compiler for a problem in one block; collected as a diagnostic. */
export class CompileProblem extends Error {
  constructor(
    message: string,
    readonly blockId: BlockId | null,
  ) {
    super(message);
    this.name = 'CompileProblem';
  }
}

export const compileError = (message: string, blockId: BlockId | null): CompileDiagnostic => ({ severity: 'error', message, blockId });
export const compileWarning = (message: string, blockId: BlockId | null): CompileDiagnostic => ({ severity: 'warning', message, blockId });
