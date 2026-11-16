import { create } from 'zustand';

/**
 * Whether the OneRoboLab API is reachable, as seen by the last request (and
 * the browser's online/offline events). Drives the "Connection lost" banner
 * and background sync. While offline it probes the server every few seconds,
 * so recovery is noticed even when nothing else is being requested.
 */
interface ConnectionState {
  readonly online: boolean;
  /** When the connection was last lost (ms), null while online. */
  readonly lostAt: number | null;
  setOnline(online: boolean): void;
}

const PROBE_MS = 5000;
let probe: (() => Promise<unknown>) | null = null;
let probeTimer: ReturnType<typeof setInterval> | undefined;

/** How to check the server (any request through the API client reports reachability). */
export function setReconnectProbe(fn: () => Promise<unknown>): void {
  probe = fn;
}

const runProbe = () => void probe?.().catch(() => undefined);

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  online: true,
  lostAt: null,
  setOnline: (online) => {
    if (online === get().online) return;
    set({ online, lostAt: online ? null : Date.now() });
    clearInterval(probeTimer);
    probeTimer = online ? undefined : setInterval(runProbe, PROBE_MS);
  },
}));

/** Run `fn` every time the connection comes back (returns an unsubscribe). */
export function onReconnect(fn: () => void): () => void {
  return useConnectionStore.subscribe((s, prev) => {
    if (s.online && !prev.online) fn();
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => useConnectionStore.getState().setOnline(false));
  // "online" only means the network is back; a probe confirms the server.
  window.addEventListener('online', runProbe);
}
