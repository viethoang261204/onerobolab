import { create } from 'zustand';
import { runController } from '../features/simulator/runtime/run-controller';
import type { SimStatus } from '../types/ui';
import { logToConsole } from './console-store';

/**
 * UI-facing run state for the Run / Stop / Reset buttons. Actions forward to
 * the run controller (validate → compile → runtime); the simulation driver
 * reports how a run ended via `settle`.
 */
interface SimulationState {
  status: SimStatus;
  run: () => void;
  stop: () => void;
  reset: () => void;
  /** A run ended on its own (finished, mission complete, crash, runtime error). */
  settle: (status: Exclude<SimStatus, 'running'>) => void;
}

export const useSimulationStore = create<SimulationState>()((set, get) => ({
  status: 'idle',
  run: () => {
    if (get().status === 'running') return;
    // Run always restarts from the beginning (predictable for learners).
    const outcome = runController.run();
    // An empty program is not a mistake: nothing happens.
    if (outcome !== 'empty') set({ status: outcome === 'started' ? 'running' : 'error' });
  },
  stop: () => {
    if (get().status !== 'running') return;
    runController.stop();
    set({ status: 'stopped' });
    logToConsole('warn', '■ PROGRAM STOPPED');
  },
  reset: () => {
    runController.reset();
    set({ status: 'idle' });
    logToConsole('info', 'Robot returned to spawn position.');
  },
  settle: (status) => {
    if (get().status === 'running') set({ status });
  },
}));
