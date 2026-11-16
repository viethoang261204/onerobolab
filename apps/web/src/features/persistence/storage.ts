/** Minimal key-value storage (localStorage-compatible), so persistence can be swapped or mocked. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage (tests, private mode, SSR). */
export function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** localStorage when available and writable, otherwise memory. */
export function browserStorage(): KeyValueStorage {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return memoryStorage();
    const probe = '__rv_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      getItem: (k) => {
        try {
          return ls.getItem(k);
        } catch {
          return null;
        }
      },
      setItem: (k, v) => {
        try {
          ls.setItem(k, v);
        } catch {
          // quota / blocked: persistence is best-effort
        }
      },
      removeItem: (k) => {
        try {
          ls.removeItem(k);
        } catch {
          // ignore
        }
      },
    };
  } catch {
    return memoryStorage();
  }
}

/** Parse JSON from storage, falling back when missing or malformed. */
export function readJson<T>(storage: KeyValueStorage, key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
