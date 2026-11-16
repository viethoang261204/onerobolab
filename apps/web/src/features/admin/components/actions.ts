import { useCallback, useState } from 'react';
import { errorMessage } from '../api/client';
import { invalidate, type Tag } from '../data/use-resource';
import { toast } from '../ui/overlay';

/**
 * Run a mutation: on success refresh the given data tags and show a toast;
 * on failure show the API's message. Returns the result, or undefined on error.
 */
export async function runAction<T>(fn: () => Promise<T>, opts: { success?: string; tags?: readonly Tag[]; rethrow?: boolean } = {}): Promise<T | undefined> {
  try {
    const result = await fn();
    if (opts.tags?.length) invalidate(...opts.tags);
    if (opts.success) toast(opts.success);
    return result;
  } catch (e) {
    if (opts.rethrow) throw e;
    toast(errorMessage(e), 'error');
    return undefined;
  }
}

/** `[busy, run]` — run() marks the component busy while the action runs. */
export function useBusy(): [boolean, <T>(fn: () => Promise<T>) => Promise<T>] {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
