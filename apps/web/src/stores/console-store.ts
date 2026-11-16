import { create } from 'zustand';
import type { ConsoleEntry, LogLevel } from '../types/ui';

const MAX_ENTRIES = 300;

interface ConsoleState {
  entries: readonly ConsoleEntry[];
  log: (level: LogLevel, message: string) => void;
  clear: () => void;
}

let nextId = 1;
const entry = (level: LogLevel, message: string): ConsoleEntry => ({ id: nextId++, level, message, at: Date.now() });

export const useConsoleStore = create<ConsoleState>()((set) => ({
  // The level session logs which mission (and map) is loaded.
  entries: [entry('info', 'OneRoboLab ready.'), entry('info', 'Robot initialized.')],
  log: (level, message) => set((s) => ({ entries: [...s.entries, entry(level, message)].slice(-MAX_ENTRIES) })),
  clear: () => set({ entries: [] }),
}));

/** Log from outside React (stores, event handlers). */
export const logToConsole = (level: LogLevel, message: string) => useConsoleStore.getState().log(level, message);
