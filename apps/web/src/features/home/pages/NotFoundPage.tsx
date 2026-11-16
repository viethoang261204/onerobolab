import { Compass, House } from 'lucide-react';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';

/** Unknown URL: friendly way back. */
export function NotFoundPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6 animate-page-in">
      <div className="glass max-w-[420px] rounded-[var(--radius-dialog)] p-8 text-center">
        <p className="font-display text-[44px] font-black text-white">404</p>
        <h1 className="mt-1 text-[18px] font-bold text-white">This part of OneRoboLab isn’t mapped yet</h1>
        <p className="mt-2 text-[14px] text-muted">The page you opened doesn’t exist. Head back home or pick a world on the map.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={() => navigate(paths.home())} className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-4 font-semibold text-white hover:bg-white/8">
            <House size={17} /> Home
          </button>
          <button type="button" onClick={() => navigate(paths.worldMap())} className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 font-semibold text-white hover:brightness-110">
            <Compass size={17} /> World map
          </button>
        </div>
      </div>
    </main>
  );
}
