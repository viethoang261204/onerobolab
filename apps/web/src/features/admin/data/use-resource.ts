import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

/*
 * Minimal data loading for the console (no query library): a hook that runs
 * a fetcher when its key changes, plus tag-based invalidation so a mutation
 * can refresh every list that shows the changed data.
 */

/** Data tags: bump one after a mutation and every resource that listens reloads. */
export type Tag = 'students' | 'curriculum' | 'worlds' | 'levels' | 'lessons' | 'achievements' | 'activity' | 'access';

const useTagStore = create<{ versions: Record<string, number> }>()(() => ({ versions: {} }));

export function invalidate(...tags: Tag[]): void {
  useTagStore.setState((s) => {
    const versions = { ...s.versions };
    for (const t of tags) versions[t] = (versions[t] ?? 0) + 1;
    return { versions };
  });
}

export interface Resource<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  /** True until the first result for this key arrives. */
  readonly loading: boolean;
  /** True while any request (including a background reload) is running. */
  readonly refreshing: boolean;
  reload(): void;
}

/**
 * Loads `fetcher()` for `key` (null = don't load). Keeps showing the previous
 * data while reloading, and ignores answers that arrive after the key changed.
 */
export function useResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  tags: readonly Tag[] = [],
  options: { readonly keepPrevious?: boolean } = {},
): Resource<T> {
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: unknown; refreshing: boolean }>({
    key: null,
    data: undefined,
    error: null,
    refreshing: key !== null,
  });
  const [nonce, setNonce] = useState(0);
  const tagVersion = useTagStore((s) => tags.map((t) => s.versions[t] ?? 0).join('.'));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const request = useRef(0);

  useEffect(() => {
    if (key === null) return;
    const n = ++request.current;
    setState((s) => ({ ...s, refreshing: true }));
    fetcherRef.current().then(
      (data) => {
        if (n === request.current) setState({ key, data, error: null, refreshing: false });
      },
      (error: unknown) => {
        if (n === request.current) setState((s) => ({ key, data: s.key === key ? s.data : undefined, error, refreshing: false }));
      },
    );
  }, [key, tagVersion, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  // keepPrevious: tables keep the last page on screen while the next one loads.
  const current = state.key === key || (!!options.keepPrevious && state.data !== undefined);
  return {
    data: current ? state.data : undefined,
    error: state.key === key ? state.error : null,
    loading: key !== null && (!current || (state.data === undefined && state.error === null)),
    refreshing: state.refreshing,
    reload,
  };
}
