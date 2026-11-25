import { create } from 'zustand';
import { logToConsole } from '../../../stores/console-store';
import * as M from '@robolab/blocks';
import { blockName, getBlockDef } from '@robolab/blocks';
import type { BlockFragment, BlockId, BlockType, DropTarget, FieldValue, ProgramState } from '@robolab/blocks';
import { cloneFragment, createBlock, extractFragment, fragmentFromBlock } from '@robolab/blocks';
import { validateProgram, type BlockIssue } from '@robolab/blocks';
import { migrateLevelId } from '../../../content/levels/registry';
import { browserStorage, readJson, type KeyValueStorage } from '../../persistence/storage';
import { createStarterProgram } from '@robolab/blocks';
import { parseProgram, serializeProgram } from '@robolab/blocks';
import { clipboard } from './clipboard';
import { emptyHistory, record, redo, undo, type History } from './history';

/** levelId → serialized program (each level keeps its own program). */
const BASE_KEY = 'roboverse.programs.v2';
const SAVE_DELAY_MS = 400;

let storage: KeyValueStorage = browserStorage();
let STORAGE_KEY = BASE_KEY;
/** Swap persistence (tests). */
export const setProgramStorage = (s: KeyValueStorage) => {
  storage = s;
};

/**
 * Keep programs per signed-in student (`roboverse.programs.v2:<id>`), so
 * students sharing a computer never see each other's work. null = the
 * signed-out/local key. Unsaved edits are written first; the editor is reset.
 */
export function setProgramNamespace(studentId: string | null): void {
  flushProgramSave();
  STORAGE_KEY = studentId ? `${BASE_KEY}:${studentId}` : BASE_KEY;
  const program = createStarterProgram();
  useProgramStore.setState({ levelId: null, program, history: emptyHistory(), selectedId: null, snap: null, ...derive(program) });
}

/** The locally saved program for a level (this student), or null. */
export function localProgram(levelId: string): ProgramState | null {
  const raw = readAll()[levelId];
  return (raw && parseProgram(raw)) || null;
}

/** Every level with a locally saved program (for background sync). */
export const localProgramLevels = (): string[] => Object.keys(readAll());

const isRecord = (v: unknown): v is Record<string, string> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** All saved programs; legacy level ids (UI 6) are mapped to current ones. */
const readAll = (): Record<string, string> => {
  const all = readJson<Record<string, string>>(storage, STORAGE_KEY, {}, isRecord);
  const out: Record<string, string> = {};
  for (const [id, raw] of Object.entries(all)) out[migrateLevelId(id)] ??= raw;
  return out;
};

/** The saved program for a level, or a fresh start block. */
function loadFor(levelId: string | null): ProgramState {
  const raw = levelId ? readAll()[levelId] : undefined;
  return (raw && parseProgram(raw)) || createStarterProgram();
}

function saveNow(levelId: string | null, p: ProgramState) {
  if (!levelId) return;
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [levelId]: serializeProgram(p) }));
}

interface CommitOptions {
  /** Console message; omitted = silent. */
  readonly log?: string;
  /** Coalesce rapid edits with the same key into one undo step. */
  readonly coalesceKey?: string;
  readonly select?: BlockId | null;
  /** Play the snap animation on this block. */
  readonly snap?: BlockId;
}

export interface ProgramStore {
  program: ProgramState;
  selectedId: BlockId | null;
  history: History<ProgramState>;
  /** Most important issue per block (derived on every commit). */
  issues: Readonly<Record<BlockId, BlockIssue>>;
  errorCount: number;
  warningCount: number;
  /** Last snapped block + sequence number (drives the snap animation). */
  snap: { id: BlockId; seq: number } | null;

  select: (id: BlockId | null) => void;
  addBlock: (type: BlockType, target: DropTarget) => BlockId | null;
  addFragment: (fragment: BlockFragment, target: DropTarget, log?: string) => BlockId | null;
  moveBlock: (id: BlockId, target: DropTarget) => boolean;
  moveRoot: (id: BlockId, x: number, y: number) => void;
  deleteBlock: (id: BlockId) => boolean;
  duplicateBlock: (id: BlockId) => BlockId | null;
  updateField: (id: BlockId, name: string, value: FieldValue) => void;
  setComment: (id: BlockId, comment: string | null) => void;
  toggleDisabled: (id: BlockId) => void;
  addVariable: (name: string) => void;
  copy: (id?: BlockId) => boolean;
  paste: () => BlockId | null;
  undo: () => void;
  redo: () => void;
  /** Clear the blocks back to just “when program starts” (undoable). */
  resetProgram: () => void;
  /** Replace the whole program (the Python editor); typing coalesces into one undo step. */
  replaceProgram: (program: ProgramState) => void;
  /** Level whose program is being edited (programs are saved per level). */
  levelId: string | null;
  /** Save the current program and load the one saved for `levelId`. */
  switchLevel: (levelId: string) => void;
  /**
   * Replace the program of `levelId` with one loaded from the server (no undo
   * step; saved locally). Ignored if another level is open by now.
   */
  loadProgram: (levelId: string, program: ProgramState) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave: (() => void) | null = null;
function scheduleSave(levelId: string | null, p: ProgramState) {
  clearTimeout(saveTimer);
  pendingSave = () => saveNow(levelId, p);
  saveTimer = setTimeout(() => {
    pendingSave?.();
    pendingSave = null;
  }, SAVE_DELAY_MS);
}
/** Write any pending save immediately (before switching levels or leaving the simulator). */
export function flushProgramSave() {
  clearTimeout(saveTimer);
  pendingSave?.();
  pendingSave = null;
}

const derive = (p: ProgramState) => {
  const v = validateProgram(p);
  return { issues: v.byBlock, errorCount: v.errors, warningCount: v.warnings };
};

let snapSeq = 0;
const initial = createStarterProgram();

/**
 * The single source of truth for the student's program. The editor reads
 * and writes it; the Python view and (UI 5) the compiler only read it.
 * Nothing in the simulator mutates it.
 */
export const useProgramStore = create<ProgramStore>()((set, get) => {
  /** Apply a new program state (or report an invalid operation). */
  const commit = (next: ProgramState, opts: CommitOptions = {}) => {
    const { program, history } = get();
    if (next === program) return;
    set({
      program: next,
      history: record(history, program, opts.coalesceKey ?? null, Date.now()),
      ...derive(next),
      ...(opts.select !== undefined && { selectedId: opts.select }),
      ...(opts.snap && { snap: { id: opts.snap, seq: ++snapSeq } }),
    });
    scheduleSave(get().levelId, next);
    if (opts.log) logToConsole('info', opts.log);
  };

  /** Run a model operation; invalid ones become a gentle console hint instead of a crash. */
  const attempt = <T>(fn: () => T): T | null => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof M.InvalidOperation) {
        logToConsole('warn', e.message);
        return null;
      }
      throw e;
    }
  };

  return {
    program: initial,
    selectedId: null,
    history: emptyHistory(),
    ...derive(initial),
    snap: null,

    select: (id) => set({ selectedId: id }),

    addBlock: (type, target) => get().addFragment(fragmentFromBlock(createBlock(type, get().program.variables)), target, `Block added: ${blockName(type)}.`),

    addFragment: (fragment, target, log) => {
      const next = attempt(() => M.insertFragment(get().program, fragment, target));
      if (!next) return null;
      commit(next, { log: log ?? 'Blocks added.', select: fragment.rootId, snap: fragment.rootId });
      return fragment.rootId;
    },

    moveBlock: (id, target) => {
      const next = attempt(() => M.moveBlock(get().program, id, target));
      if (!next) return false;
      const label = blockName(get().program.blocks[id]?.type ?? 'motion.stop');
      const verb = target.kind === 'workspace' ? 'moved' : target.kind === 'slot' ? 'nested' : 'connected';
      commit(next, { log: `Block ${verb}: ${label}.`, select: id, snap: id });
      return true;
    },

    moveRoot: (id, x, y) => commit(M.moveRoot(get().program, id, x, y), { select: id }),

    deleteBlock: (id) => {
      const block = get().program.blocks[id];
      if (!block) return false;
      const next = attempt(() => M.deleteBlock(get().program, id));
      if (!next) return false;
      commit(next, { log: `Block deleted: ${blockName(block.type)}.`, select: null });
      return true;
    },

    duplicateBlock: (id) => {
      const result = attempt(() => M.duplicateBlock(get().program, id));
      if (!result) return null;
      commit(result.program, { log: 'Block duplicated.', select: result.newId, snap: result.newId });
      return result.newId;
    },

    updateField: (id, name, value) => commit(M.updateField(get().program, id, name, value), { coalesceKey: `field:${id}:${name}` }),

    setComment: (id, comment) => commit(M.setComment(get().program, id, comment), { coalesceKey: `comment:${id}` }),

    toggleDisabled: (id) => {
      const block = get().program.blocks[id];
      if (!block) return;
      commit(M.setDisabled(get().program, id, !block.disabled), { log: block.disabled ? 'Block enabled.' : 'Block disabled — it will be skipped.' });
    },

    addVariable: (name) => commit(M.addVariable(get().program, name), { log: `Variable created: ${name.trim()}.` }),

    copy: (id) => {
      const target = id ?? get().selectedId;
      if (!target || target === M.START_ID || !get().program.blocks[target]) return false;
      clipboard.set(extractFragment(get().program, target));
      logToConsole('info', 'Block copied.');
      return true;
    },

    paste: () => {
      const clip = clipboard.get();
      if (!clip) return null;
      const copy = cloneFragment(clip);
      const { program, selectedId } = get();
      const head = copy.blocks[copy.rootId];
      if (!head) return null;
      const stackable = ['statement', 'c'].includes(getBlockDef(head.type).shape);
      const selected = selectedId ? program.blocks[selectedId] : undefined;
      // Paste below the selected block when possible, otherwise next to the program.
      const target: DropTarget =
        stackable && selected && M.checkDrop(program, copy.blocks, copy.rootId, { kind: 'after', blockId: selected.id }).ok
          ? { kind: 'after', blockId: selected.id }
          : { kind: 'workspace', x: 300 + (snapSeq % 5) * 20, y: 40 + (snapSeq % 5) * 20 };
      return get().addFragment(copy, target, 'Block pasted.');
    },

    undo: () => {
      const r = undo(get().history, get().program);
      if (!r) return;
      set({ program: r.state, history: r.history, ...derive(r.state), selectedId: null });
      scheduleSave(get().levelId, r.state);
      logToConsole('info', 'Undo.');
    },

    redo: () => {
      const r = redo(get().history, get().program);
      if (!r) return;
      set({ program: r.state, history: r.history, ...derive(r.state), selectedId: null });
      scheduleSave(get().levelId, r.state);
      logToConsole('info', 'Redo.');
    },

    resetProgram: () => commit(createStarterProgram(), { log: 'Program cleared — only “when program starts” is left.', select: null }),

    replaceProgram: (program) => commit(program, { coalesceKey: 'python', select: null }),

    levelId: null,
    switchLevel: (levelId) => {
      if (get().levelId === levelId) return;
      flushProgramSave();
      const program = loadFor(levelId);
      set({ levelId, program, history: emptyHistory(), selectedId: null, snap: null, ...derive(program) });
    },

    loadProgram: (levelId, program) => {
      if (get().levelId !== levelId) {
        saveNow(levelId, program);
        return;
      }
      clearTimeout(saveTimer);
      pendingSave = null;
      set({ program, history: emptyHistory(), selectedId: null, snap: null, ...derive(program) });
      saveNow(levelId, program);
    },
  };
});

/** Read-only access for non-React code (e.g. the UI 5 compiler). */
export const getProgram = (): ProgramState => useProgramStore.getState().program;
