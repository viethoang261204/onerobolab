import { useLayoutEffect, useRef } from 'react';

/** Distance from the bottom (px) within which we keep following new content. */
const STICKY_THRESHOLD = 32;

/**
 * Keeps a scroll container pinned to the bottom when `dep` changes, unless
 * the user has scrolled up to read older content.
 */
export function useAutoScroll<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const stick = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [dep]);

  const onScroll = () => {
    const el = ref.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_THRESHOLD;
  };

  return { ref, onScroll };
}
