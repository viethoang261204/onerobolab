import { createMapEngine } from '@robolab/map-engine';
import { ROVER } from '@robolab/robot-engine';
import type { LevelDefinition } from '../../content/levels/types';
import { applyVariant, variantCount } from '../../content/levels/variants';
import { compileProgram } from '@robolab/blocks';
import type { ProgramState } from '@robolab/blocks';
import { RobotRuntime } from '../simulator/robot/RobotMovement';
import { SimulationRuntime } from '@robolab/simulation';

/** Simulated seconds a run may take in tests (the Arena takes a while). */
export const MAX_SECONDS = 400;

/**
 * Headless run of a level (layout `variant`) with a block program — the
 * same runtime the simulator uses, without rendering. Tests only.
 */
export function playLevel(level: LevelDefinition, program: ProgramState, variant = 0) {
  const played = applyVariant(level, variant);
  const map = createMapEngine().load(played.map);
  const robot = new RobotRuntime(ROVER, played.map.start);
  const sim = new SimulationRuntime({ map, robot, mission: played.mission, ...(played.data && { data: played.data }) });
  const compiled = compileProgram(program, ROVER);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  sim.runProgram(compiled.program);
  for (let i = 0; i < MAX_SECONDS * 60 && sim.state === 'running'; i++) sim.step();
  return { sim, blockCount: compiled.blockCount };
}

/** Every layout index of a level. */
export const layouts = (level: LevelDefinition): number[] => Array.from({ length: variantCount(level) }, (_, i) => i);
