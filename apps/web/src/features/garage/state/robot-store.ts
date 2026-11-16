import { create } from 'zustand';
import { browserStorage, type KeyValueStorage } from '../../persistence/storage';
import { DEFAULT_CONFIG, normalizeConfig, type RobotConfiguration } from '../model/robot-config';

/*
 * The student's saved robots (up to four) and which one is theirs right now
 * (the "personal robot" shown on the map, the Home hero and in the simulator).
 * Stored per student through `KeyValueStorage`; a backend store can replace
 * it behind `RobotPersistence` without touching the UI.
 */

export const MAX_ROBOTS = 4;
const KEY = 'roboverse.robots.v1';

export interface RobotCollection {
  readonly version: 1;
  readonly active: number;
  readonly robots: readonly RobotConfiguration[];
}

export interface RobotPersistence {
  load(namespace: string): RobotCollection | null;
  save(namespace: string, collection: RobotCollection): void;
}

export const DEFAULT_COLLECTION: RobotCollection = { version: 1, active: 0, robots: [DEFAULT_CONFIG] };

/** Any stored value → a valid collection. */
export function normalizeCollection(raw: unknown): RobotCollection {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const robots = (Array.isArray(r.robots) ? r.robots : []).slice(0, MAX_ROBOTS).map(normalizeConfig);
  if (!robots.length) return DEFAULT_COLLECTION;
  const active = typeof r.active === 'number' && Number.isInteger(r.active) && r.active >= 0 && r.active < robots.length ? r.active : 0;
  return { version: 1, active, robots };
}

export function localRobotPersistence(storage: KeyValueStorage = browserStorage()): RobotPersistence {
  return {
    load: (ns) => {
      const raw = storage.getItem(`${KEY}:${ns}`);
      if (!raw) return null;
      try {
        return normalizeCollection(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    save: (ns, c) => storage.setItem(`${KEY}:${ns}`, JSON.stringify(c)),
  };
}

let persistence: RobotPersistence = localRobotPersistence();
/** Tests / a future API store. */
export function setRobotPersistence(p: RobotPersistence): void {
  persistence = p;
}

interface RobotStoreState extends RobotCollection {
  namespace: string;
  /** Load the robots of this student (null = signed out → defaults, not saved). */
  setNamespace: (studentId: string | null) => void;
  /** Save a robot into a slot (append when `slot` = length) and make it the active robot. */
  saveRobot: (slot: number, config: RobotConfiguration) => void;
  setActive: (slot: number) => void;
}

export const useRobotStore = create<RobotStoreState>()((set, get) => ({
  ...DEFAULT_COLLECTION,
  namespace: '',
  setNamespace: (studentId) => {
    const ns = studentId ?? '';
    set({ namespace: ns, ...(ns ? (persistence.load(ns) ?? DEFAULT_COLLECTION) : DEFAULT_COLLECTION) });
  },
  saveRobot: (slot, config) => {
    const s = get();
    const robots = [...s.robots];
    const i = Math.max(0, Math.min(slot, robots.length, MAX_ROBOTS - 1));
    robots[i] = normalizeConfig(config);
    const next: RobotCollection = { version: 1, active: i, robots };
    set(next);
    if (s.namespace) persistence.save(s.namespace, next);
  },
  setActive: (slot) => {
    const s = get();
    if (slot < 0 || slot >= s.robots.length) return;
    const next: RobotCollection = { version: 1, active: slot, robots: s.robots };
    set({ active: slot });
    if (s.namespace) persistence.save(s.namespace, next);
  },
}));

/** The student's personal robot (for rendering anywhere in OneRoboLab). */
export const usePersonalRobot = (): RobotConfiguration => useRobotStore((s) => s.robots[s.active] ?? DEFAULT_CONFIG);
