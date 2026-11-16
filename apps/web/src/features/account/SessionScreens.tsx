import { CloudOff, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { useConnectionStore } from '../api/connection-store';
import { useCatalogStore } from '../catalog/catalog-store';
import { useSyncStore } from '../programming/state/program-sync';
import { signOut } from './session-actions';
import { buttonClass } from '../../components/common/Button';

/** While the student's journey loads after sign-in. */
export function JourneyLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg" role="status" aria-label="Loading your journey">
      <Loader2 size={34} className="animate-spin text-cyan" />
      <p className="font-display text-[17px] font-bold text-white">Loading your journey…</p>
    </div>
  );
}

/** The journey couldn't be loaded (offline, server down). */
export function JourneyError() {
  const error = useCatalogStore((s) => s.error);
  const load = useCatalogStore((s) => s.load);
  return (
    <div className="flex h-full items-center justify-center bg-bg p-6">
      <div className="glass w-full max-w-[420px] rounded-[var(--radius-dialog)] p-7 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
          <CloudOff size={24} />
        </span>
        <h1 className="mt-3 font-display text-[22px] font-black text-white">Can’t reach OneRoboLab</h1>
        <p className="mt-2 text-[14px] text-muted">{error ?? 'Check your internet connection and try again.'}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void signOut()} className={buttonClass('outline')}>
            Sign out
          </button>
          <button type="button" onClick={() => void load()} className={buttonClass('primary')}>
            <RefreshCw size={16} /> Try again
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Fixed banner while the API can't be reached. Programs keep saving on this
 * device and are uploaded when the connection returns.
 */
export function ConnectionBanner() {
  const online = useConnectionStore((s) => s.online);
  const syncStatus = useSyncStore((s) => s.status);
  if (online && syncStatus !== 'offline') return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-[var(--radius-control)] border border-white/10 bg-[#0f1b2e]/95 py-2.5 pl-3.5 pr-4 text-[13.5px] text-[#e2e8f0] shadow-[0_12px_32px_-12px_rgb(0_0_0/0.8)]">
        <WifiOff size={17} className="shrink-0 text-warning" aria-hidden="true" />
        <span>
          <span className="font-semibold text-white">Connection lost.</span> Your program is saved locally.
        </span>
      </div>
    </div>
  );
}
