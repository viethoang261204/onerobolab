/**
 * Snapshot undo/redo. Programs are immutable, so a snapshot is just a
 * reference (unchanged blocks are shared between snapshots).
 *
 * Only completed operations are recorded. Rapid edits of the same field are
 * coalesced (`key` + time window), so typing "30" is one undo step.
 */
export interface History<T> {
  readonly past: readonly T[];
  readonly future: readonly T[];
  readonly lastKey: string | null;
  readonly lastAt: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1200;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [], lastKey: null, lastAt: 0 });

/** Record `previous` before a change. Same `key` within the window replaces nothing (coalesces). */
export function record<T>(h: History<T>, previous: T, key: string | null, now: number): History<T> {
  if (key !== null && key === h.lastKey && now - h.lastAt < COALESCE_MS) {
    return { ...h, future: [], lastAt: now };
  }
  const past = [...h.past, previous];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, future: [], lastKey: key, lastAt: now };
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  const state = h.past[h.past.length - 1];
  if (state === undefined) return null;
  return { history: { past: h.past.slice(0, -1), future: [current, ...h.future], lastKey: null, lastAt: 0 }, state };
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  const state = h.future[0];
  if (state === undefined) return null;
  return { history: { past: [...h.past, current], future: h.future.slice(1), lastKey: null, lastAt: 0 }, state };
}
