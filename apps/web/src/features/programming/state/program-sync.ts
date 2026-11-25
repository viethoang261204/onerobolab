import { create } from 'zustand';
import { isNetworkError, type ApiError } from '../../api/client';
import { onReconnect, useConnectionStore } from '../../api/connection-store';
import { studentApi } from '../../account/student-api';
import { browserStorage, readJson, type KeyValueStorage } from '../../persistence/storage';
import type { ProgramState } from '@robolab/blocks';
import { parseProgram, serializeProgram } from '@robolab/blocks';
import { generatePython } from '../generators/python-generator';
import { localProgram, localProgramLevels, setProgramNamespace, useProgramStore } from './program-store';

/*
 * Keeps each level's program on the server (Student Phase 4) while the
 * browser copy stays the safety net:
 *
 *   edit → saved locally at once (program-store) → pushed to the API after a
 *   short pause. Offline or failing? The local copy is kept, marked "dirty",
 *   and pushed when the connection returns. Opening a level loads the
 *   server's program unless the local copy has newer, unsynced edits.
 *
 * Per student (namespaced storage), so shared computers don't mix work.
 */

const PUSH_DELAY_MS = 1500;

/** Sync bookkeeping per level: are there local edits the server hasn't got, and which server copy were they based on. */
export interface SyncMeta {
  readonly dirty: boolean;
  /** `updatedAt` of the server program the local copy started from (null = never synced). */
  readonly base: string | null;
}

export type SyncDecision = 'use-server' | 'push-local' | 'keep-local' | 'server-wins-conflict';

/**
 * Which copy to use when a level opens. Local edits win only when they are
 * newer than the server copy they were based on; if the server changed
 * meanwhile (another device), the server wins and the local copy is backed up.
 */
export function decideProgram(local: { exists: boolean; meta: SyncMeta | undefined }, server: { updatedAt: string } | null): SyncDecision {
  const dirty = local.exists && (local.meta?.dirty ?? false);
  if (!server) return dirty ? 'push-local' : 'keep-local';
  if (!local.exists || !dirty) return 'use-server';
  return local.meta?.base === server.updatedAt ? 'push-local' : 'server-wins-conflict';
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface SyncState {
  readonly status: SyncStatus;
  /** Why the last save failed / what happened (shown next to the status). */
  readonly message: string | null;
  readonly savedAt: number | null;
}

export const useSyncStore = create<SyncState>()(() => ({ status: 'idle', message: null, savedAt: null }));

let storage: KeyValueStorage = browserStorage();
let studentId: string | null = null;
let metaKey = '';
let applying = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let cleanups: (() => void)[] = [];

const isMetaRecord = (v: unknown): v is Record<string, SyncMeta> => typeof v === 'object' && v !== null && !Array.isArray(v);
const readMeta = (): Record<string, SyncMeta> => readJson(storage, metaKey, {}, isMetaRecord);
const metaFor = (levelId: string): SyncMeta | undefined => readMeta()[levelId];
function setMeta(levelId: string, meta: SyncMeta) {
  storage.setItem(metaKey, JSON.stringify({ ...readMeta(), [levelId]: meta }));
}

const toBody = (p: ProgramState, createVersion: boolean) => ({
  blockProgram: JSON.parse(serializeProgram(p)) as unknown,
  pythonCode: generatePython(p),
  ...(createVersion && { createVersion: true }),
});

/** The server can't be reached: the program stays on this device (the connection store probes for recovery). */
function offline() {
  useSyncStore.setState({ status: 'offline', message: 'Connection lost. Your program is saved locally.' });
  useConnectionStore.getState().setOnline(false);
}

/**
 * Send one level's program to the server. Returns true when the server has
 * it. Network failures keep it dirty (retried on reconnect); refusals (e.g.
 * a block the level doesn't allow) are reported and not retried in a loop.
 */
export async function pushProgram(levelId: string, opts: { createVersion?: boolean } = {}): Promise<boolean> {
  if (!studentId) return false;
  const store = useProgramStore.getState();
  const program = store.levelId === levelId ? store.program : localProgram(levelId);
  if (!program) return false;
  useSyncStore.setState({ status: 'saving', message: null });
  try {
    const res = await studentApi.saveProgram(levelId, toBody(program, opts.createVersion ?? false));
    // Edits made while the request was in flight stay dirty.
    const current = useProgramStore.getState();
    const stillSame = current.levelId !== levelId || current.program === program;
    setMeta(levelId, { dirty: !stillSame, base: res.program.updatedAt });
    if (!stillSame) schedulePush();
    useSyncStore.setState({ status: 'saved', message: null, savedAt: Date.now() });
    return true;
  } catch (e) {
    if (isNetworkError(e)) offline();
    else useSyncStore.setState({ status: 'error', message: (e as ApiError).message ?? 'Your program could not be saved online. It is kept on this device.' });
    return false;
  }
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const levelId = useProgramStore.getState().levelId;
    if (levelId) void pushProgram(levelId);
  }, PUSH_DELAY_MS);
}

/** Push every level with unsynced local edits (after the connection returns). */
export async function pushAllDirty(): Promise<void> {
  const dirty = Object.entries(readMeta())
    .filter(([, m]) => m.dirty)
    .map(([id]) => id);
  for (const id of dirty) {
    if (!(await pushProgram(id))) return;
  }
}

/** Make sure the server has the open level's program right now (before a run / "Test in Simulator"). */
export async function flushProgram(opts: { createVersion?: boolean } = {}): Promise<boolean> {
  const levelId = useProgramStore.getState().levelId;
  if (!levelId || !studentId) return false;
  clearTimeout(pushTimer);
  const meta = metaFor(levelId);
  if (meta && !meta.dirty && meta.base && !opts.createVersion) return true;
  return pushProgram(levelId, opts);
}

/** A level was opened: load the server program, or keep / push newer local edits. */
export async function syncLevel(levelId: string): Promise<void> {
  if (!studentId) return;
  const requested = useProgramStore.getState().program;
  let server: Awaited<ReturnType<typeof studentApi.getProgram>>['program'];
  try {
    server = (await studentApi.getProgram(levelId)).program;
  } catch (e) {
    if (isNetworkError(e)) offline();
    return; // keep the local copy
  }
  const current = useProgramStore.getState();
  // The student already edited while we were loading: their edits win.
  const editedMeanwhile = current.levelId === levelId && current.program !== requested;
  const meta = editedMeanwhile ? { dirty: true, base: metaFor(levelId)?.base ?? null } : metaFor(levelId);
  const decision = decideProgram({ exists: editedMeanwhile || localProgram(levelId) !== null, meta }, server);

  if (decision === 'push-local' || (editedMeanwhile && decision !== 'use-server')) {
    await pushProgram(levelId);
    return;
  }
  if (decision === 'keep-local' || !server) return;
  const parsed = parseProgram(JSON.stringify(server.blockProgram));
  if (!parsed) return;
  if (decision === 'server-wins-conflict') {
    const backup = localProgram(levelId);
    if (backup) storage.setItem(`roboverse.programs.backup:${studentId}:${levelId}`, serializeProgram(backup));
    useSyncStore.setState({ status: 'saved', message: 'Loaded your newest program saved on another device. Your older copy is kept as a backup.' });
  }
  applying = true;
  try {
    useProgramStore.getState().loadProgram(levelId, parsed);
  } finally {
    applying = false;
  }
  setMeta(levelId, { dirty: false, base: server.updatedAt });
}

/** Start syncing for a signed-in student (namespaces local programs). */
export function startProgramSync(id: string, s: KeyValueStorage = browserStorage()): void {
  stopProgramSync();
  storage = s;
  studentId = id;
  metaKey = `roboverse.sync.v1:${id}`;
  setProgramNamespace(id);
  useSyncStore.setState({ status: 'idle', message: null, savedAt: null });
  cleanups = [
    useProgramStore.subscribe((st, prev) => {
      if (!st.levelId) return;
      if (st.levelId !== prev.levelId) {
        void syncLevel(st.levelId);
        return;
      }
      if (applying || st.program === prev.program) return;
      setMeta(st.levelId, { dirty: true, base: metaFor(st.levelId)?.base ?? null });
      if (useConnectionStore.getState().online) schedulePush();
      else offline();
    }),
    onReconnect(() => {
      if (useSyncStore.getState().status === 'offline') useSyncStore.setState({ status: 'idle', message: null });
      void pushAllDirty();
    }),
  ];
  // Anything left unsynced from last time goes up now.
  if (localProgramLevels().length) void pushAllDirty();
}

/** Stop syncing (sign-out). The local copies stay on this device, per student. */
export function stopProgramSync(): void {
  clearTimeout(pushTimer);
  for (const c of cleanups) c();
  cleanups = [];
  if (studentId) setProgramNamespace(null);
  studentId = null;
}
