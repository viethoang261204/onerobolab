/**
 * @robolab/blockly-engine — block definitions, toolbox and the compiler from
 * Blockly workspace JSON to RoboLab IR. The compiler is pure and testable
 * without a DOM; only block registration touches Blockly itself.
 *
 * Status: contract only. Implementation lands in Phase 5 (see docs/ROADMAP.md).
 */
export type { CompileDiagnostic, CompileResult, ProgramCompiler } from '@robolab/shared';
