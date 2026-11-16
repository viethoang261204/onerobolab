import { isNetworkError } from '../api/client';
import { onReconnect } from '../api/connection-store';
import { studentApi, type RunFinish, type RunOutcome, type RunReport } from '../account/student-api';
import { flushProgram } from '../programming/state/program-sync';

/*
 * One simulator run as the server sees it (Student Phase 4):
 *
 *   Run pressed  → the program is saved, then POST /levels/:id/runs creates a
 *                  RUNNING attempt with a snapshot of that program;
 *   run ends     → POST /runs/:id/finish with what the simulator observed.
 *
 * The server decides pass/fail, stars and XP. If the connection drops, the
 * finish is retried when it returns (the attempt id makes it safe: a run can
 * be finished once).
 */

export type FinishResult =
  | { readonly kind: 'saved'; readonly finish: RunFinish }
  /** Couldn't reach the server; `retry` resolves when it's saved later (or null if it never is). */
  | { readonly kind: 'offline'; readonly retry: Promise<RunFinish | null> }
  /** No server attempt (the run couldn't be registered); nothing will be saved. */
  | { readonly kind: 'unsaved'; readonly message: string };

interface ActiveRun {
  readonly levelId: string;
  readonly started: Promise<string | null>;
  finished: boolean;
}

let active: ActiveRun | null = null;
let startError: string | null = null;

/** Run pressed (user program). Saves the program, then registers the run on the server. */
export function beginRun(levelId: string): void {
  if (active && !active.finished) void endRun('STOPPED', { objectivesCompleted: [], timeSeconds: 0, collisions: 0 });
  startError = null;
  const started = (async () => {
    try {
      if (!(await flushProgram())) {
        startError = 'Your program is saved on this device only, so this run can’t be recorded.';
        return null;
      }
      return (await studentApi.startRun(levelId)).run.id;
    } catch (e) {
      startError = isNetworkError(e) ? 'Connection lost — this run can’t be recorded. Your program is saved locally.' : ((e as Error).message ?? 'This run could not be recorded.');
      return null;
    }
  })();
  active = { levelId, started, finished: false };
}

/** The run in progress belongs to this level (the simulator may have been left). */
export const runInProgress = (levelId: string) => !!active && !active.finished && active.levelId === levelId;

function finishWithRetry(runId: string, outcome: RunOutcome, report: RunReport): Promise<RunFinish | null> {
  return new Promise((resolve) => {
    const off = onReconnect(() => {
      studentApi.finishRun(runId, outcome, report).then(
        (f) => {
          off();
          resolve(f);
        },
        (e: unknown) => {
          if (!isNetworkError(e)) {
            off();
            resolve(null);
          }
        },
      );
    });
  });
}

/** The run ended in the simulator: send what happened, get the server's verdict. */
export async function endRun(outcome: RunOutcome, report: RunReport): Promise<FinishResult> {
  const run = active;
  if (!run || run.finished) return { kind: 'unsaved', message: 'This run wasn’t registered.' };
  run.finished = true;
  const runId = await run.started;
  if (!runId) return { kind: 'unsaved', message: startError ?? 'This run could not be recorded.' };
  try {
    return { kind: 'saved', finish: await studentApi.finishRun(runId, outcome, report) };
  } catch (e) {
    if (isNetworkError(e)) return { kind: 'offline', retry: finishWithRetry(runId, outcome, report) };
    return { kind: 'unsaved', message: (e as Error).message };
  }
}

/** Forget the current run (sign-out). */
export function resetRunSession(): void {
  active = null;
  startError = null;
}
