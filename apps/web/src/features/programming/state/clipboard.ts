import type { BlockFragment } from '@robolab/blocks';

/**
 * In-app block clipboard. Holds a serializable fragment; paste always clones
 * it with fresh ids, so the same copy can be pasted many times.
 */
let current: BlockFragment | null = null;

export const clipboard = {
  set(fragment: BlockFragment): void {
    current = fragment;
  },
  get(): BlockFragment | null {
    return current;
  },
  clear(): void {
    current = null;
  },
};
