import type { RobotDefinition } from '@robolab/shared';
import { logToConsole } from '../../../stores/console-store';
import { useUiStore } from '../../../stores/ui-store';
import { LevelRegistry } from '../../../content/levels/registry';
import { variantCount } from '../../../content/levels/variants';
import { pickVariant } from '../../levels/variant-store';
import { Analytics } from '../../analytics/analytics';
import { START_ID } from '@robolab/blocks';
import { blockName } from '@robolab/blocks';
import { subtreeIds } from '@robolab/blocks';
import { useSettingsStore } from '../../settings/settings-store';
import { compileProgram } from '@robolab/blocks';
import { getProgram, useProgramStore } from '../../programming/state/program-store';
import { useRuntimeStore } from './runtime-store';
import type { SimulationRuntime } from '@robolab/simulation';

let current: { runtime: SimulationRuntime; robot: RobotDefinition } | null = null;

/** What pressing Run did: started the robot, nothing (no blocks yet), or refused with an explanation. */
export type RunOutcome = 'started' | 'empty' | 'refused';

const EMPTY_HINT = 'Nothing to run yet — drag blocks under “when program starts”.';

/**
 * RUN / STOP / RESET, as used by the simulation store:
 *   validate → compile → start runtime (or refuse with an explanation).
 * The block editor never talks to the robot; this is the only bridge, and it
 * only reads the program.
 */
export const runController = {
  attach(runtime: SimulationRuntime, robot: RobotDefinition): void {
    current = { runtime, robot };
  },

  detach(runtime: SimulationRuntime): void {
    if (current?.runtime === runtime) current = null;
  },

  /** Starts the robot; an empty program does nothing (no error), a broken one is refused with an explanation. */
  run(): RunOutcome {
    if (!current) return 'refused';
    const program = getProgram();
    useRuntimeStore.getState().apply({ errorBlockId: null });

    if (!program.blocks[START_ID]?.next) {
      // The demo autopilot is a developer tool: it must not complete levels for students.
      if (useSettingsStore.getState().debug) {
        logToConsole('info', 'Debug: no blocks — running the demo line-follower (no progress is saved).');
        useRuntimeStore.getState().apply({ blockCount: 0 });
        current.runtime.runDemo();
        return 'started';
      }
      logToConsole('info', EMPTY_HINT);
      return 'empty';
    }

    const refuse = (message: string, blockId: string | null) => {
      logToConsole('error', `Program has errors — the robot didn’t start. ${message}`.trim());
      Analytics.track('program_error', { reason: message });
      if (blockId) {
        useUiStore.getState().setCodeTab('blocks');
        useProgramStore.getState().select(blockId);
        useRuntimeStore.getState().apply({ errorBlockId: blockId });
      }
      return 'refused' as const;
    };

    // Levels can limit which blocks are available.
    const level = LevelRegistry.get(useProgramStore.getState().levelId ?? '');
    if (level && level.allowedBlocks !== 'all') {
      const allowed = new Set<string>(level.allowedBlocks);
      const reachable = subtreeIds(program.blocks, START_ID, true);
      // Functions run where they are called: their blocks count too.
      for (const r of program.roots) if (program.blocks[r.id]?.type === 'function.define') for (const id of subtreeIds(program.blocks, r.id, true)) reachable.add(id);
      const blocked = [...reachable].map((id) => program.blocks[id]).find((b) => b && !b.disabled && !allowed.has(b.type));
      if (blocked) return refuse(`The “${blockName(blocked.type)}” block isn’t available in this level.`, blocked.id);
    }

    logToConsole('info', 'Compiling program...');
    const result = compileProgram(program, current.robot);
    if (!result.ok) {
      const first = result.diagnostics.find((d) => d.severity === 'error');
      return refuse(first?.message ?? '', first?.blockId ?? null);
    }
    // Only disabled blocks: nothing would move — same as an empty program.
    if (result.blockCount === 0) {
      logToConsole('info', EMPTY_HINT);
      return 'empty';
    }
    useRuntimeStore.getState().apply({ blockCount: result.blockCount });
    Analytics.track('program_run', { level: level?.id ?? null, blocks: result.blockCount });
    for (const w of result.diagnostics.filter((d) => d.severity === 'warning')) logToConsole('warn', w.message);
    logToConsole('info', `${result.blockCount} ${result.blockCount === 1 ? 'block' : 'blocks'} compiled.`);
    logToConsole('info', '▶ PROGRAM STARTED');
    useProgramStore.getState().select(null);
    current.runtime.runProgram(result.program);
    return 'started';
  },

  stop(): void {
    current?.runtime.stop();
  },

  /** Robot back to the start; levels with layouts get a new random layout. */
  reset(): void {
    current?.runtime.reset();
    const level = LevelRegistry.get(useProgramStore.getState().levelId ?? '');
    if (level && variantCount(level) > 1) pickVariant(level);
  },

  pause(): void {
    current?.runtime.pause();
  },

  resume(): void {
    current?.runtime.resume();
  },
};
