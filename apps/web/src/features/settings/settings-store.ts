import { create } from 'zustand';
import { browserStorage, readJson, type KeyValueStorage } from '../persistence/storage';

export type Quality = 'high' | 'medium' | 'low';
export type CodingLanguage = 'blocks' | 'python';

export interface Settings {
  readonly codingLanguage: CodingLanguage;
  readonly sound: boolean;
  /** 0–1. */
  readonly volume: number;
  /** Reserved for background music (no music assets yet). */
  readonly music: boolean;
  readonly showHints: boolean;
  /** null = follow the OS "reduce motion" preference. */
  readonly reducedMotion: boolean | null;
  readonly quality: Quality;
  /** Developer overlay (FPS, draw calls, runtime state). */
  readonly debug: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  codingLanguage: 'blocks',
  sound: true,
  volume: 0.6,
  music: false,
  showHints: true,
  reducedMotion: null,
  // Medium by default: capped resolution + 1024² shadows keeps laptops near 60 FPS.
  quality: 'medium',
  debug: false,
};

const KEY = 'roboverse.settings.v1';

const isSettings = (v: unknown): v is Partial<Settings> => typeof v === 'object' && v !== null;

export function loadSettings(storage: KeyValueStorage): Settings {
  const saved = readJson<Partial<Settings>>(storage, KEY, {}, isSettings);
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  return {
    ...merged,
    codingLanguage: merged.codingLanguage === 'python' ? 'python' : 'blocks',
    volume: Math.min(1, Math.max(0, Number(merged.volume) || 0)),
    quality: (['high', 'medium', 'low'] as const).includes(merged.quality) ? merged.quality : 'medium',
  };
}

/** Effective reduced motion: explicit setting, else the OS preference. */
export function resolveReducedMotion(setting: boolean | null, osPrefersReduced: boolean): boolean {
  return setting ?? osPrefersReduced;
}

const osReduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface SettingsState extends Settings {
  /** Resolved value used by the UI and renderer. */
  reduceMotion: boolean;
  set: (patch: Partial<Settings>) => void;
}

let storage: KeyValueStorage = browserStorage();

/** Swap the storage (tests). */
export const setSettingsStorage = (s: KeyValueStorage) => {
  storage = s;
};

const initial = loadSettings(storage);

/** Persisted user settings (local). */
export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...initial,
  reduceMotion: resolveReducedMotion(initial.reducedMotion, osReduced()),
  set: (patch) => {
    const { set: _s, reduceMotion: _r, ...current } = get();
    const next: Settings = { ...current, ...patch };
    storage.setItem(KEY, JSON.stringify(next));
    set({ ...next, reduceMotion: resolveReducedMotion(next.reducedMotion, osReduced()) });
  },
}));
