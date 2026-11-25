import { create } from 'zustand';
import { EMPTY_SENSORS, type RuntimeSnapshot } from '@robolab/simulation';

interface RuntimeStore extends RuntimeSnapshot {
  /** Blocks compiled for the current run (star scoring). */
  blockCount: number;
  /** Push a snapshot (called a few times per second, and on important events). */
  apply: (snapshot: Partial<RuntimeSnapshot> & { blockCount?: number }) => void;
}

/**
 * What the UI shows about the running program: active/error block,
 * variables, sensor values, mission state. Updated from runtime events and a
 * throttled snapshot — never every simulation tick. Components select single
 * fields so e.g. only the two affected blocks re-render when the active
 * block changes.
 */
export const useRuntimeStore = create<RuntimeStore>()((set) => ({
  runState: 'idle',
  mode: 'userProgram',
  time: 0,
  activeBlockId: null,
  errorBlockId: null,
  variables: {},
  sensors: EMPTY_SENSORS,
  mission: null,
  pose: { x: 0, z: 0, heading: 0 },
  speed: 0.5,
  blockCount: 0,
  apply: (snapshot) => set(snapshot),
}));
