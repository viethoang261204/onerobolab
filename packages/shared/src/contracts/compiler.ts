import type { Program } from '../types/program.ts';

export interface CompileDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  /** Editor block to highlight, if known. */
  readonly blockId: string | null;
}

export type CompileResult =
  | {
      readonly ok: true;
      readonly program: Program;
      /** Number of source blocks, used for efficiency scoring. */
      readonly blockCount: number;
      readonly diagnostics: readonly CompileDiagnostic[];
    }
  | { readonly ok: false; readonly diagnostics: readonly CompileDiagnostic[] };

/**
 * Compiles an editor representation into IR. The Blockly Engine implements
 * `ProgramCompiler<BlocklyWorkspaceJson>`; other front-ends (text, AI) could
 * implement it for other sources without touching the Robot Engine.
 */
export interface ProgramCompiler<TSource> {
  compile(source: TSource): CompileResult;
}
